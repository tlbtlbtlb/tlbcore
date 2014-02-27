{
  'targets': [
    {
      'target_name': 'arma',
      'include_dirs+': ['..','../..'],
      'includes': [
        '../nodeif/setup.gypi',
      ],
      'sources': [
        './arma_jswrap.cc',
      ]
    }
  ]
}

