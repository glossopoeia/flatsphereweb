# Shared failure policy for the build-time hygiene hooks in this directory.
#
# Under `jekyll build` a violated convention fails the build: raising Jekyll's FatalException
# makes the command layer print its clean "YOUR SITE COULD NOT BE BUILT" banner and exit
# non-zero, so a deploy stops.
#
# Under `jekyll serve` or `--watch` the same problem is only warned about. jekyll-watch rescues
# anything raised during a regeneration, logs two "Error:" lines, and keeps serving the previous
# _site without writing or live-reloading, so a raise there would leave the author looking at a
# stale page with no visible sign of why. Warning lets the regeneration finish, so the page shows
# its degraded state and the terminal says what to fix.
#
# Messages must be single lines: Jekyll's logger collapses all whitespace to single spaces.
module BuildGuard
  def self.fail_or_warn(site, topic, message)
    if site.config["serving"] || site.config["watch"]
      Jekyll.logger.warn "#{topic}:", message
    else
      raise Jekyll::Errors::FatalException, message
    end
  end
end
