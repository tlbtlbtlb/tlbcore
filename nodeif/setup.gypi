{
  'conditions': [
    ['OS=="mac"', {
      'xcode_settings': {
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES', 
        'GCC_ENABLE_CPP_RTTI': 'YES', 
        'MACOSX_DEPLOYMENT_TARGET': '10.7',
        'OTHER_CFLAGS': ['-stdlib=libc++', 
                         '-std=c++11', '-DARMA_MAT_PREALLOC=16',
                         '-Wall', '-Wextra', 
                         '-Wno-format-nonliteral', '-Wno-missing-prototypes', '-Wno-unused-parameter', 
                         '-Wno-c++11-extensions',
                         '-Winit-self', '-Wno-shadow', '-Wpointer-arith', '-Wcast-qual']
      },
      'include_dirs+': [
        '/usr/local/include',
        "<!(node -e \"require('nan')\")"
      ],
      'libraries+': [
        '-L/usr/local/lib', '-larmadillo', '-lz'
      ]
    }, {
      'make_global_settings': [
        ['CXX','/usr/bin/clang++'],
        ['LINK','/usr/bin/clang++'],
      ],
      'include_dirs+': [
        "<!(node -e \"require('nan')\")"
      ],
      'libraries+': [
        '-larmadillo', '-lz'
      ],
      'cflags_cc!': [
        '-fno-rtti', '-fno-exceptions', '-fno-tree-vrp'
      ],
      'cflags_cc': [
        '-std=c++11', '-DARMA_MAT_PREALLOC=16'
      ]
    }],
  ]
}
