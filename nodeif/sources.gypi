{
  'xcode_settings': {
    'GCC_ENABLE_CPP_EXCEPTIONS': 'YES', 
    'GCC_ENABLE_CPP_RTTI': 'YES', 
    'MACOSX_DEPLOYMENT_TARGET': '10.7',
    'OTHER_CFLAGS': ['-stdlib=libc++']
  },
  'conditions': [
    ['OS=="mac"', {
      'include_dirs': [
        '/opt/local/include',
      ],
      'libraries+': [
        '-L/opt/local/lib', '-larmadillo',
      ],
    }],
    ['OS=="linux"', {
      'libraries+': [
        '-larmadillo',
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
    '../geom/solid_geometry.cc',
    '../genes/genes.cc',
    '../genes/test_genes.cc',
    '../common/LogBase.cc',
    '../common/hacks.cc',
    '../common/refcount.cc',
    '../common/packetbuf.cc',
    '../common/anythreads.cc',
    '../common/host_debug.cc',
    '../common/jsonio.cc',
    '../numerical/polyfit.cc'
  ]
}
