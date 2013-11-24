
{
    'targets': [
        {
            'target_name': 'tlbcore',
            'include_dirs+': ['..','../..'],
            'cflags_cc!': ['-fno-rtti', '-fno-exceptions'],
            'xcode_settings': {'GCC_ENABLE_CPP_EXCEPTIONS': 'YES', 'GCC_ENABLE_CPP_RTTI': 'YES'},
            'sources': [
                './main.cc',
                './jswrapbase.cc',
                '../geom/geom_math.cc',
                '../genes/genes.cc', 
                '../genes/test_genes.cc',
                '../build.src/functions_jsWrap.cc',
                '../build.src/rtfns.cc',
                '../realtime/TcpJsonConn.cc', 
                '../realtime/LatencyTest.cc',
                '../common/LogBase.cc', 
                '../common/hacks.cc', 
                '../common/refcount.cc', 
                '../common/packetbuf.cc',
                '../common/exceptions.cc', 
                '../common/anythreads.cc', 
                '../common/host_debug.cc', 
                '../common/jsonio.cc',
                '../build.src/jsboot.cc',
                '../build.src/TestStruct_jsWrap.cc', '../build.src/TestStruct_host.cc',
                '../build.src/Mat22_jsWrap.cc', '../build.src/Mat22_host.cc',
                '../build.src/Mat33_jsWrap.cc', '../build.src/Mat33_host.cc',
                '../build.src/Mat44_jsWrap.cc', '../build.src/Mat44_host.cc',
                '../build.src/Vec2_jsWrap.cc', '../build.src/Vec2_host.cc',
                '../build.src/Vec3_jsWrap.cc', '../build.src/Vec3_host.cc',
                '../build.src/Vec4_jsWrap.cc', '../build.src/Vec4_host.cc',
                '../build.src/Ea3_jsWrap.cc', '../build.src/Ea3_host.cc',
                '../build.src/Quaternion_jsWrap.cc', '../build.src/Quaternion_host.cc',
                '../build.src/Polyfit3_jsWrap.cc', '../build.src/Polyfit3_host.cc'
            ]
        }
    ]
}

