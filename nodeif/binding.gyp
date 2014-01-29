
{
    'targets': [
        {
            'target_name': 'ur',
            'include_dirs+': ['..','../..'],
            'cflags_cc!': ['-fno-rtti', '-fno-exceptions'],
            'xcode_settings': {'GCC_ENABLE_CPP_EXCEPTIONS': 'YES', 'GCC_ENABLE_CPP_RTTI': 'YES'},
          'includes': [
            './sources.gypi', 
            '../build.src/sources_root.gypi',
          ],
          'sources': [
            './main.cc',
          ]
        }
    ]
}

