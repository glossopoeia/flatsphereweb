serve:
	mkdir -p _data && cp data/projections.json _data/projections.json
	bundle exec jekyll serve --livereload
