.PHONY: deploy
deploy:
	make html && rsync -avz build/html/ root@65.109.190.148:/var/www/html/kiwistand

.PHONY: html
html:
	sphinx-multiversion source build/html

.PHONY: build
build:
	sphinx-build -b html source build

.PHONY: serve
serve:
	make build && python3 -m http.server -d build
