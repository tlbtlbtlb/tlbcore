

typereg.struct('Vec2', 
               ['x', 'double'],
               ['y', 'double']);

typereg.struct('Vec3', 
               ['x', 'double'],
               ['y', 'double'],
               ['z', 'double']);

typereg.struct('Vec4', 
               ['x', 'double'],
               ['y', 'double'],
               ['z', 'double'],
               ['a', 'double']);


typereg.struct('Mat22', 
               ['xx', 'double'],
               ['xy', 'double'],
               ['yx', 'double'],
               ['yy', 'double']);

typereg.struct('Mat33', 
               ['xx', 'double'],
               ['xy', 'double'],
               ['xz', 'double'],
               ['yx', 'double'],
               ['yy', 'double'],
               ['yz', 'double'],
               ['zx', 'double'],
               ['zy', 'double'],
               ['zz', 'double']);

typereg.struct('Mat44', 
               ['xx', 'double'],
               ['xy', 'double'],
               ['xz', 'double'],
               ['xa', 'double'],
               ['yx', 'double'],
               ['yy', 'double'],
               ['yz', 'double'],
               ['ya', 'double'],
               ['zx', 'double'],
               ['zy', 'double'],
               ['zz', 'double'],
               ['za', 'double'],
               ['ax', 'double'],
               ['ay', 'double'],
               ['az', 'double'],
               ['aa', 'double']);


typereg.struct('Ea3',
               ['pitch', 'double'],
               ['roll', 'double'],
               ['yaw', 'double']);

typereg.struct('Quaternion',
               ['a', 'double'],
               ['b', 'double'],
               ['c', 'double'],
               ['d', 'double']);

typereg.struct('Polyfit3',
               ['c0', 'double'],
               ['c1', 'double'],
               ['c2', 'double'],
               ['c3', 'double']);

typereg.struct('Polyfit5',
               ['c0', 'double'],
               ['c1', 'double'],
               ['c2', 'double'],
               ['c3', 'double'],
               ['c4', 'double'],
               ['c5', 'double']);


typereg.scanCHeader(require.resolve('./geom_math.h'));
