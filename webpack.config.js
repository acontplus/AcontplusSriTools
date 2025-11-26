const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    
    entry: {
      background: './src/background/index.ts',
      'content/index': './src/content/index.ts',
      'popup/index': './src/popup/index.ts',
      'services/feedback-modal': './src/services/feedback-modal.ts',
      'services/download-counter': './src/services/download-counter.ts',
      'services/supabase': './src/services/supabase.ts',
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@content': path.resolve(__dirname, 'src/content'),
        '@popup': path.resolve(__dirname, 'src/popup'),
        '@background': path.resolve(__dirname, 'src/background'),
      },
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },

    plugins: [
      new MiniCssExtractPlugin({
        filename: 'assets/css/[name].css',
      }),
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'popup/popup.html', to: 'popup/popup.html' },
          { from: 'icons', to: 'icons' },
          { from: 'assets/css', to: 'assets/css' },
          { from: 'assets/fonts', to: 'assets/fonts' },
          { from: 'assets/js', to: 'assets/js' },
        ],
      }),
    ],

    optimization: {
      minimize: isProduction,
      runtimeChunk: {
        name: (entrypoint) => {
          // No runtime chunk para background y servicios
          if (entrypoint.name === 'background' || entrypoint.name.startsWith('services/')) {
            return false;
          }
          return 'runtime';
        },
      },
      splitChunks: {
        chunks: (chunk) => {
          // No split chunks para background y servicios
          return chunk.name && chunk.name !== 'background' && !chunk.name.startsWith('services/');
        },
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: (chunk) => chunk.name && chunk.name !== 'background' && !chunk.name.startsWith('services/'),
            priority: 10,
            enforce: true,
          },
          shared: {
            name: 'shared',
            chunks(chunk) {
              return chunk.name !== 'background' && chunk.name && !chunk.name.startsWith('services/');
            },
            minChunks: 2,
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      },
    },
  };
};
