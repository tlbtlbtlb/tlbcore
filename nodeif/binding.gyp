
{
    'targets': [
        {
            'target_name': 'tlbcore',
            'include_dirs+': ['..','../..'],
            'cflags_cc!': ['-fno-rtti', '-fno-exceptions'],
            'xcode_settings': {'GCC_ENABLE_CPP_EXCEPTIONS': 'YES', 'GCC_ENABLE_CPP_RTTI': 'YES'},
          'includes': [
            './sources.gypi', 
            '../build.src/sources_root.gypi',
          ],
          'sources': [
            './main.cc',
            '../geom/geom_math.cc',
            '../genes/genes.cc', 
            '../genes/test_genes.cc',
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
            ]
        }
    ]
}

