
{
  'conditions': [
    ['OS=="linux"', {
      'make_global_settings': [
        ['CXX', '/usr/bin/clang++'],
        ['LINK', '/usr/bin/clang++'],
      ],
    }]
  ],
  'targets': [
    {
      'target_name': 'ur',
      'include_dirs+': ['..','../..'],
      'includes': [
        './setup.gypi',
        './sources.gypi',
        '../geom/sources.gypi',
        '../build.src/sources_root.gypi',
      ],
      'sources': [
        './main.cc',
      ]
    }
  ]
}

