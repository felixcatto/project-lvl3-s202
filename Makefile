install:
	npm install


start:
	npm run babel-node './src/bin/page-loader.js'


build:
	rm -rf dist
	npm run build


lint:
	npm run eslint --silent src
	npm run eslint --silent __tests__


publish: build
	npm publish


test:
	npm run jest --silent


testw:
	npm run jest --silent -- --watch
