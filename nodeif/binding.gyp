
{
  'targets': [
    {
      'target_name': 'ur',
      'include_dirs+': ['..','../..'],
      'includes': [
        './setup.gypi',
        './sources.gypi',
        '../build.src/sources_root.gypi',
      ],
      'sources': [
        './main.cc',
      ]
    }
  ]
}

