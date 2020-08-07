const path = require('path');
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const AngularCompilerPlugin = require('@ngtools/webpack').AngularCompilerPlugin;

if (process.env.NODE_ENV == null) {
    process.env.NODE_ENV = 'development';
}
const ENV = process.env.ENV = process.env.NODE_ENV;

const moduleRules = [
    {
        test: /\.ts$/,
        enforce: 'pre',
        loader: 'tslint-loader',
    },
    {
        test: /\.(html)$/,
        loader: 'html-loader',
    },
    {
        test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
        include: [path.resolve('src/popup/css/webfonts/'), path.resolve('node_modules/font-awesome')],
        use: [{
            loader: 'file-loader',
            options: {
                name: '[name].[ext]',
                outputPath: 'popup/fonts/',
                publicPath: './fonts/',
            },
        }],
    },
    {
        test: /\.(jpe?g|png|gif|svg)$/i,
        exclude: /.*(fontawesome-webfont|glyphicons-halflings-regular)\.svg/,
        use: [{
            loader: 'file-loader',
            options: {
                name: '[name].[ext]',
                outputPath: 'popup/images/',
                publicPath: './images/',
            },
        }],
    },
    {
        test: /\.scss$/,
        use: [
            {
                loader: MiniCssExtractPlugin.loader,
                options: {
                    publicPath: '../',
                }
            },
            'css-loader',
            'sass-loader',
        ],
    },
    // Hide System.import warnings. ref: https://github.com/angular/angular/issues/21560
    {
        test: /[\/\\]@angular[\/\\].+\.js$/,
        parser: { system: true },
    },
];

const plugins = [
    new CleanWebpackPlugin([
        path.resolve(__dirname, 'build/*'),
    ]),
    // ref: https://github.com/angular/angular/issues/20357
    new webpack.ContextReplacementPlugin(/\@angular(\\|\/)core(\\|\/)fesm5/,
        path.resolve(__dirname, './src')),
    new HtmlWebpackPlugin({
        template: './src/popup/index.html',
        filename: 'popup/index.html',
        chunks: ['popup/vendor', 'popup/main'],
    }),
    new HtmlWebpackPlugin({
        template: './src/background.html',
        filename: 'background.html',
        chunks: ['vendor', 'background'],
    }),
    new HtmlWebpackPlugin({
        template: './src/notification/bar.html',
        filename: 'notification/bar.html',
        chunks: ['notification/bar']
    }),
    new HtmlWebpackPlugin({
        template: './src/inPageMenu/menu.html',
        filename: 'inPageMenu/menu.html',
        chunks: ['inPageMenu/menu']
    }),
    new HtmlWebpackPlugin({
        template: './src/inPageMenu/loginMenu.html',
        filename: 'inPageMenu/loginMenu.html',
        chunks: ['inPageMenu/loginMenu']
    }),
    new CopyWebpackPlugin([
        './src/manifest.json',
        { from: './src/_locales', to: '_locales' },
        { from: './src/images', to: 'images' },
        { from: './src/popup/images', to: 'popup/images' },
        { from: './src/content/autofill.css', to: 'content' },
        { from: './src/content/notification.css', to: 'content' },
        { from: './node_modules/font-awesome/*', to: 'inPageMenu/fonts/' },
    ]),
    new webpack.SourceMapDevToolPlugin({
        include: ['popup/main.js', 'background.js'],
    }),
    new MiniCssExtractPlugin({
        filename: '[name].css',
        chunkFilename: 'chunk-[id].css',
    }),
    new webpack.DefinePlugin({
        'process.env': {
            'ENV': JSON.stringify(ENV)
        }
    }),
];

if (ENV === 'production') {
    moduleRules.push({
        test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
        loader: '@ngtools/webpack',
    });
    plugins.push(new AngularCompilerPlugin({
        tsConfigPath: 'tsconfig.json',
        entryModule: 'src/popup/app.module#AppModule',
        sourceMap: true,
    }));
} else {
    moduleRules.push({
        test: /\.ts$/,
        loaders: ['ts-loader', 'angular2-template-loader'],
        exclude: path.resolve(__dirname, 'node_modules'),
    });
}

const config = {
    mode: ENV,
    devtool: false,
    entry: {
        'popup/main': './src/popup/main.ts',
        'background': './src/background.ts',
        'content/appInfo': './src/content/appInfo.ts',
        'content/autofill': './src/content/autofill.js',
        'content/autofiller': './src/content/autofiller.ts',
        'content/notificationBar': './src/content/notificationBar.ts',
        'content/shortcuts': './src/content/shortcuts.ts',
        'notification/bar': './src/notification/bar.js',
        'inPageMenu/menu': './src/inPageMenu/menu.js',
        'inPageMenu/loginMenu': './src/inPageMenu/loginMenu.js',
    },
    optimization: {
        minimize: ENV === 'production',
        splitChunks: {
            cacheGroups: {
                commons: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'popup/vendor',
                    chunks: (chunk) => {
                        return chunk.name === 'popup/main';
                    },
                },
                commons2: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendor',
                    chunks: (chunk) => {
                        return chunk.name === 'background';
                    },
                },
            },
        },
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
        alias: {
            'jslib': path.join(__dirname, 'jslib/src'),
            'cozy-client': path.join(__dirname, 'node_modules/cozy-client/dist/node')
        },
        symlinks: false,
        modules: [path.resolve('node_modules')],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'build'),
    },
    module: { rules: moduleRules },
    plugins: plugins,
};
module.exports = config;
