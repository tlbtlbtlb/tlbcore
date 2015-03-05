#!/usr/local/bin/python
from anycore import *
from _anycore import *
from anycore.haltonseq import *

DEFAULT_ITERCOUNT=300

@extend_class
def stl_solid__search_region(self):
    """
    Return a corner & diagonal measurement for the bounding box, but increased slightly to ensure
    that we don't exactly align on one of the faces
    """
    fudge = vec3(0.001, 0.001, 0.001)
    corner = self.bbox_lo - fudge
    diagonal = self.bbox_hi + fudge - corner

    return corner, diagonal

@extend_class
def stl_solid__estimate_rog(self, itercount=DEFAULT_ITERCOUNT):
    """
    Estimate the radius of gyration, around each axis, for the STL solid. Return a vec3 with those radii.
    We assume a homogenous solid.

    It's done by Monte Carlo integration. We choose random points along the axis and random directions, and
    do ray casting to see where the material is in that direction. itercount sets the number of samples
    
    A large value of itercount (10000) seems to be necessary for long pieces like the shank. The rays are
    somewhat heavy-tailed in MOI, since only a few rays point down the length of the shaft.
    """
    corner, diagonal = self.search_region()

    moi_x_accum = moi_y_accum = moi_z_accum = 0.0
    volume_x_accum = volume_y_accum = volume_z_accum = 0.0

    testcount=0
    for testnorm in unipolar_halton_iter(2):
        # Choose random points along the X axis
        pt_x = vec3(corner.x + testnorm[0]*diagonal.x, 0, 0)
        pt_y = vec3(0, corner.y + testnorm[0]*diagonal.y, 0)
        pt_z = vec3(0, 0, corner.z + testnorm[0]*diagonal.z)
        th=testnorm[1]*2.0*pi
        # and a vector of unit length in a random direction in the YZ plane
        dir_yz = vec3(0, sin(th), cos(th))
        dir_xz = vec3(sin(th), 0, cos(th))
        dir_xy = vec3(cos(th), sin(th), 0)

        # moi is proportional to r**2. We're integrating r**2 from minr to maxr, and
        # the size of our sector is proportional r, so that's
        # 1/4 r**4
        # volume is proportional to r, so integrate to get 1/2 r**2
        
        ts = self.intersection_list(pt_x, dir_yz)
        if len(ts)>0:
            for tsi in range(0, len(ts), 2):
                minr = ts[tsi].t
                maxr = ts[tsi+1].t
                moi_x_accum += (maxr**4 - minr**4) * pi/2
                volume_x_accum += (maxr**2 - minr**2) * pi

        ts = self.intersection_list(pt_y, dir_xz)
        if len(ts)>0:
            for tsi in range(0, len(ts), 2):
                minr = ts[tsi].t
                maxr = ts[tsi+1].t
                moi_y_accum += (maxr**4 - minr**4) * pi/2
                volume_y_accum += (maxr**2 - minr**2) * pi

        ts = self.intersection_list(pt_z, dir_xy)
        if len(ts)>0:
            for tsi in range(0, len(ts), 2):
                minr = ts[tsi].t
                maxr = ts[tsi+1].t
                moi_z_accum += (maxr**4 - minr**4) * pi/2
                volume_z_accum += (maxr**2 - minr**2) * pi

        testcount+=1
        if testcount>itercount: break

    moi_x = moi_x_accum * (diagonal.x / testcount)
    volume_x = volume_x_accum * (diagonal.x / testcount)
    try:
        rog_x = sqrt(moi_x / volume_x)
    except ZeroDivisionError:
        rog_x = 0.001

    moi_y = moi_y_accum * (diagonal.y / testcount)
    volume_y = volume_y_accum * (diagonal.y / testcount)
    try:
        rog_y = sqrt(moi_y / volume_y)
    except ZeroDivisionError:
        rog_y = 0.001

    moi_z = moi_z_accum * (diagonal.z / testcount)
    volume_z = volume_z_accum * (diagonal.z / testcount)
    try:
        rog_z = sqrt(moi_z / volume_z)
    except ZeroDivisionError:
        rog_z = 0.001

    moi = vec3(moi_x, moi_y, moi_z)
    volume = vec3(volume_x, volume_y, volume_z)
    rog = vec3(rog_x, rog_y, rog_z)

    if 0: print "ROG estimate: moi=",moi*1000,"(liters-m^2) volume=",volume*1e3,"(liters) rog=",rog

    return rog
    

@extend_class
def stl_solid__estimate_volume(self, itercount=DEFAULT_ITERCOUNT):
    """
    Estimate the volume of the solid. We choose random points on the XY plane and calculate the section
    along the Z axis by ray casting.
    """
    corner, diagonal = self.search_region()

    volume_accum = 0.0
    centerx_accum = centery_accum = centerz_accum = center_denom = 0.0

    testcount=0
    for testnorm in unipolar_halton_iter(2):
        # Choose random points in the XY plane
        pt = vec3(corner.x + testnorm[0]*diagonal.x, corner.y + testnorm[1]*diagonal.y, corner.z)

        # and pointing to the other side. We want unit length so t == actual distance
        d = vec3(0.0, 0.0, diagonal.z/abs(diagonal.z))
        
        ts = self.intersection_list(pt, d)

        if len(ts)>0:
            for tsi in range(0, len(ts), 2):
                minz = ts[tsi].t + corner.z
                maxz = ts[tsi+1].t + corner.z

                volume_accum += (maxz - minz)

                centerx_accum += pt.x * (maxz-minz)
                centery_accum += pt.y * (maxz-minz)
                centerz_accum += (maxz+minz)/2 * (maxz-minz)
                center_denom += maxz-minz

        testcount+=1
        if testcount>itercount: break

    volume = volume_accum * (diagonal.x * diagonal.y / testcount)
    center = vec3(centerx_accum / center_denom,
                  centery_accum / center_denom,
                  centerz_accum / center_denom)
    
    return volume, center


@extend_class
def stl_solid__analyze_hole(self, itercount=DEFAULT_ITERCOUNT, directions_out=None):
    """ Find the direction and location of a hole near the origin mostly aligned with the Z axis.
    If you need another direction, transform the stl_solid first.
    """

    corner, diagonal = self.search_region()

    directions = []

    testcount=0
    for testnorm in unipolar_halton_iter(2):
        
        # Choose random points along the Z axis
        # and a vector of unit length in a random direction in the XY plane
        th=testnorm[1]*2.0*pi
        avec = vec3(0,0,1)
        pt = vec3(0, 0, corner.z + testnorm[0]*diagonal.z)
        d = vec3(cos(th), sin(th), 0)

        ts = self.intersection_list(pt, d)
        for si in ts[0:min(2,len(ts))]:
            if si.face.area>0:
                si_pt = pt + d*si.t
                tangent = avec.cross(si.face.normal).normalized()
                realaxis = tangent.cross(si.face.normal).normalized()
                realaxis = realaxis * -1.0

                if avec.dot(realaxis) > 0.9:
                    directions.append(realaxis)

        testcount += 1
        if testcount>itercount: break

    # Sort them in decreasing order of dot product with avec
    directions.sort(lambda a,b: -cmp(avec.dot(a), avec.dot(b)))

    if len(directions)<10: return None

    # Keep the elite 70%
    directions[int(len(directions)*0.7):] = []

    avg_dir = (reduce(operator.add, directions)) * (1.0/len(directions))

    return avg_dir
            
