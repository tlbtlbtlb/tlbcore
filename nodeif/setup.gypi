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
  ]
}
