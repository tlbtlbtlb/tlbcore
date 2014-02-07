{
  'xcode_settings': {
    'GCC_ENABLE_CPP_EXCEPTIONS': 'YES', 
    'GCC_ENABLE_CPP_RTTI': 'YES', 
    'MACOSX_DEPLOYMENT_TARGET': '10.7',
    'OTHER_CFLAGS': ['-stdlib=libc++']
  },
  'conditions': [
    ['OS=="linux"', {
      'libraries+': [
        '-llapack',
      ],
      'cflags_cc!': [
        '-fno-rtti', '-fno-exceptions'
      ],
    }],
  ],
  'sources': [
    '../nodeif/jswrapbase.cc',
    '../nodeif/fastJson.cc',
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
    '../lapack/lapack_if.cc',
    '../lapack/polyfit.cc'
  ]
}
