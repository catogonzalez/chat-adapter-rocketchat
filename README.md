# Rocket.Chat adapter for Universal Chat Widget (UCW)

Connect the open source [Universal Chat Widget](https://github.com/catogonzalez/universal-chat-widget) to your Rocket.Chat backend. Using the UCW you can enable live web chat not only for livechat rooms but also for private channels.


## Prerequisites

This adapter implements the necessary methods for the chat widget to connect with the fantastic Rocket.Chat web chat platform. You will need:
* A [Rocket.Chat](https://rocket.chat) instance 
* A copy of the [Universal Chat Widget](https://github.com/catogonzalez/universal-chat-widget)


## Getting Started

`
mkdir my-chat-widget
cd my-chat-widget
git clone https://github.com/121services/universal-chat-widget
npm run dev
`
The `chat-adapter-rocketchat` is listed as a dependency for the UCW so you don't need to install it


## Local development
The following instructions are a copy from http://justjs.com/posts/npm-link-developing-your-own-npm-modules-without-tears

npm link: symbolic links to the rescue
Fortunately npm provides a tool to avoid this tedium. And it's easy to use. But there's a catch.

Here's how it's supposed to work:

1. cd to src/appy

2. Run "npm link". This creates a symbolic link from a global folder to the src/appy folder.

3. cd to src/mysite

4. Run "npm link appy". This links "node_modules/appy" in this particular project to the global folder, so that "require" calls looking for appy wind up loading it from your development folder, src/appy.

Mission accomplished... almost. If you installed Node in a typical way, using MacPorts or Ubuntu's apt-get, then npm's "global" folders are probably in a location shared system-wide, like /opt/local/npm or /usr/lib/npm. And this is not good, because it means those "npm link" commands are going to fail unless you run them as root.


## New adapter development
If you want to develop a new adapter to connect the Universal Chat Widget with any other backend, follow [these instructions](https://github.com/catogonzalez/universal-chat-widget).

 
## Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report

# run unit tests
npm run unit

# run e2e tests
npm run e2e

# run all tests
npm test
```

## Built With

* [webpack](https://webpack.js.org/) - The JS modules bundler

## Contributing

If you have a feature request or found a bug, please open an issue [here](https://github.com/catogonzalez/chat-adapter-rocketchat/issues)

Help with developing and maintaining the code is welcome. Please read [CONTRIBUTING.md](https://github.com/catogonzalez/chat-adapter-rocketchat/contributing.md) for details on our code of conduct, and the process for submitting pull requests.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/catogonzalez/chat-adapter-rocketchat/tags). 

## Authors

* **Carlos Gonzalez** - *Initial work* - [catogonzalez](https://github.com/catogonzalez)

This project was initially created and is sponsored by [121 Services](https://121.services); you build chatbots? use 121 Services' Bot Platform: it integrates with anything that has an API. 

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

This library webpack boilerplate code config is based on https://github.com/krasimir/webpack-library-starter




