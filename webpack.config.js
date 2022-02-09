/* eslint-disable no-undef */
const path = require('path')
const HtmlWEbpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const ErrorOverlayPlugin = require('error-overlay-webpack-plugin')
const ProvidePlugin = require('webpack/lib/ProvidePlugin')

module.exports = {
    entry: './src/index.js',
    target: 'web',

    output: {
        path: path.join(__dirname, '/dist'),
        filename: 'bundle.js',
        publicPath: '/',
    },

    devServer: {
        host: '127.0.0.1',
        port: 3000,
        https: false,

        historyApiFallback: true,

        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                secure: false,
            },
            '/socket/': {
                target: 'http://localhost:5000',
                secure: false,
            },
        },
    },

    resolve: {
        extensions: ['.js', '.json'],
        modules: [path.join(__dirname, './src'), 'node_modules'],
    },

    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
            {
                test: /\.s?css$/,
                oneOf: [
                    {
                        test: /\.m\.s?css$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            {
                                loader: 'css-loader',
                                options: {
                                    modules: {
                                        localIdentName:
                                            '[name]_[local]_[hash:base64]',
                                    },
                                },
                            },
                            'sass-loader',
                        ],
                    },
                    {
                        use: [
                            MiniCssExtractPlugin.loader,
                            'css-loader',
                            'sass-loader',
                        ],
                    },
                ],
            },

            {
                test: /\.(png|jpe?g|gif|webp)$/,
                use: [
                    {
                        loader: 'file-loader',
                    },
                ],
            },
        ],
    },

    plugins: [
        new HtmlWEbpackPlugin({
            template: './public/index.html',
        }),
        new MiniCssExtractPlugin(),
        new ErrorOverlayPlugin(),
        new ProvidePlugin({
            React: 'react',
            PropTypes: 'prop-types',
            classnames: 'classnames',
        }),
    ],

    devtool: 'cheap-module-source-map',
}