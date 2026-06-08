# Build-time hygiene: every blog post must declare its own `excerpt:` in front
# matter. We drive three things off post.excerpt: 1) the blog listing, 2) the Atom
# feed <summary>, and 3) the SEO <meta name="description">. A missing excerpt would
# silently degrade all three as Jekyll falls back to dumping the whole first
# paragraph. Fail the build instead of shipping that.
#
# Detection: an author-supplied excerpt is a String; Jekyll's auto-generated
# fallback is a Jekyll::Excerpt object. Checking `is_a?(String)` distinguishes
# "the author wrote one" from "Jekyll made one up" independent of when excerpts
# are generated, so the guard can't be fooled by lazy excerpt generation.
#
# Scope note: site.posts.docs excludes `published: false` posts, and drafts only
# appear when building with --drafts — so work-in-progress isn't blocked unless
# you explicitly build drafts.

Jekyll::Hooks.register :site, :post_read do |site|
  offenders = site.posts.docs.reject do |doc|
    excerpt = doc.data["excerpt"]
    excerpt.is_a?(String) && !excerpt.strip.empty?
  end

  next if offenders.empty?

  files = offenders.map { |doc| doc.relative_path }.join(", ")

  # Raise the typed exception Jekyll's command layer rescues (jekyll/command.rb:29)
  # so the build prints a clean "YOUR SITE COULD NOT BE BUILT" banner and exits
  # non-zero instead of a Ruby backtrace. Jekyll's logger collapses all whitespace
  # to single spaces (LogAdapter#message), so this message is intentionally one line.
  raise Jekyll::Errors::FatalException,
        "#{offenders.size} post(s) missing a non-empty `excerpt:` in front matter: " \
        "#{files}. A post's excerpt drives the blog listing, the Atom feed summary, " \
        "and the SEO meta description — add e.g. `excerpt: \"A sentence or two.\"` to each."
end
