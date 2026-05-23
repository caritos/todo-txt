module.exports = function (api) {
  const isTest = api.env() === 'test';
  api.cache(true);

  return {
    presets: isTest ? [
      ['@babel/preset-env', { targets: { node: 'current' } }],
      '@babel/preset-typescript',
    ] : ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@shared': '../shared',
          },
        },
      ],
      !isTest ? 'react-native-reanimated/plugin' : null,
    ].filter(Boolean),
  };
};
