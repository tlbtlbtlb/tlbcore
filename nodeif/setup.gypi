{
  'conditions': [
    ['OS=="mac"', {
      'xcode_settings': {
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES', 
        'GCC_ENABLE_CPP_RTTI': 'YES', 
        'MACOSX_DEPLOYMENT_TARGET': '10.7',
        'OTHER_CFLAGS': ['-stdlib=libc++', 
                         '-std=c++11',
                         '-Wall', '-Wextra', 
                         '-Wno-format-nonliteral', '-Wno-missing-prototypes', '-Wno-unused-parameter', 
                         '-Wno-c++11-extensions',
                         '-Winit-self', '-Wshadow', '-Wpointer-arith', '-Wcast-qual']
      },
      'include_dirs+': [
        '/usr/local/include',
      ],
      'libraries+': [
        '-L/usr/local/lib', '-larmadillo',
      ]
    }],
    ['OS=="linux"', {
      'make_global_settings': [
        ['CXX','/usr/bin/clang++'],
        ['LINK','/usr/bin/clang++'],
      ],
      'libraries+': [
        '-larmadillo',
      ],
      'cflags_cc!': [
        '-fno-rtti', '-fno-exceptions', '-fno-tree-vrp'
      ],
      'cflags_cc': [
        '-std=c++11'
      ]
    }],
  ]
}
