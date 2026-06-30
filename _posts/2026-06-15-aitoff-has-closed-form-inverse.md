---
title: A Closed-Form Inverse for the Aitoff Projection
excerpt: "The Aitoff projection's inverse is widely treated as an iterative-only problem in modern cartographic software. I was surprised to find that there's a closed-form solution with good numeric properties. A short derivation gives a non-iterative formula that matches Newton–Raphson to machine precision on the interior of the projection's domain and improves on it near the antipodes."
math: true
---

This is a story of how recent AI tools helped me re-discover a cleaner method for computing the inverse of a century-old projection. While the Aitoff projection isn't terribly popular (you're probably better off using Hammer in most applicable scenarios), this re-discovery helps correct the record, and was the most intriguing experience I've had to date with one of the brand-name LLMs.

**For the non-technical audience**: a closed-form equation (e.g. the quadratic formula) is often easier to comprehend and more efficient to compute than an 'iterative solution' for a given mathematical function. For the latter, you have to compute the same set of steps multiple times, using the approximated result from the last round to generate a better estimate. Usually, the higher the number of rounds you iterate, the better the approximation. A closed-form solution often has many benefits compared to the approximation: 1) the set of steps only gets computed once, 2) the solution is often more accurate for less work, and 3) even when it's not more accurate, it sometimes has better numerical 'behavior' compared to a result arrived at iteratively.

So, the fact that the Aitoff projection has a closed-form inverse that few major implementers are using means there's opportunity for improvement!

## Background

The Aitoff projection is a compromise projection first described in the late 1800's by David Aitoff. It looks very similar to, and was invented just shortly before, the much better known Hammer (or Hammer-Aitoff) projection. The Hammer projection has the nice property of being equal area, while the original Aitoff projection, based on the azimuthal equidistant projection, ends up preserving no cartographic properties. Hammer's work was used much more throughout the 20th century, but was often mistakenly attributed to Aitoff (even by [NASA](https://asd.gsfc.nasa.gov/archive/idlastro/ftp/pro/astro/aitoff.pro)!) due to the two projections' visual similarity and Hammer's own careful citation of Aitoff's work as his inspiration.

I myself fell into this trap when reimplementing both of these projections for Flatsphere. On my first attempt I found an incorrect method for the inverse Aitoff projection, that was really just another form of the inverse Hammer projection. When I was testing the projections, swapping between them to inspect the difference, I found that they were almost pixel-by-pixel the same. It was then that I uncovered several papers teasing out the continuing history of misattribution, and decided to employ our great new tool, the Large-Language Model, to help sift through all the variations and implement a proper Aitoff.

It didn't take long for Claude Opus 4.7 to find the usual method for inverting the projection using a standard Newton-Raphson iterative technique. I already had a decently-performant iterative inverse implemented on the GPU for the Mollweide projection, so I referred Claude to that to help me scaffold it out. I then got a very surprising response:

> Good feedback. Let me first verify the proper Aitoff inverse approach — Aitoff actually DOES have a closed-form inverse (contrary to common belief, but it's derivable from the fact that Aitoff is equatorial azimuthal-equidistant of (lat, lon/2)). Let me verify before coding.

Because I hadn't instructed it to look for a closed-form inverse, I was surprised that it brought it up. I asked it if it derived that inverse itself or if it had pulled it from some buried part of its training data. It went and checked the broader online cartography literature and source code for sources, but ended up finding that nearly all the popular implementations use the iterative method. Then Claude hit me with this line, followed shortly by an explanatory paragraph:

> Honest answer: I derived it from first principles in this conversation. But the idea shouldn't be surprising — it follows directly from Aitoff's definition.

> **What the literature says.** I checked PROJ, d3-geo, the Wikipedia article, and Google Scholar. PROJ explicitly cites Bildirici & Ipbüker 2002 ("A General Algorithm for the Inverse Transformation of Map Projections Using Jacobian Matrices") and uses nested Newton-Raphson loops. d3-geo also iterates (25 rounds with hand-coded partial derivatives). Wikipedia's Aitoff article doesn't mention an inverse at all. Bildirici-Ipbüker treat Aitoff as a worked example for their general iterative method. The one Scholar hit mentioning "Aitoff equal-area" with closed-form relations (Jackson & Bloxham 1991) is almost certainly Hammer-Aitoff (i.e., Hammer), which everyone knows is closed-form.

This was the most fascinating interaction I've had with an AI agent to date (in truth, most interactions are bog standard while also being incredibly convenient). To me, this singular chat bordered on true creativity: the agent was instructed to perform a task, even in a certain way, but immediately noticed a more efficient technique and suggested that instead. It did this, so it claims, without having that answer directly baked into its training data.

A bit later, we widened the literature check beyond PROJ and d3-geo. [Justin Kunimune's Map-Projections](https://github.com/jkunimune/Map-Projections), the Java projection library Flatsphere itself descended from, has had a closed-form Aitoff inverse since at least 2017. Given that his software was the inspiration for Flatsphere, it was myopic of me not to check here first. He doesn't write down the algebraic identity, though. His version is structural: apply the polar azimuthal-equidistant inverse to $(x/2, y)$, then run the result through an oblique transformation that rotates the polar pole back to the equator, then double the longitude. This actually makes his implementation the most readable of them all at three lines of Java, and it's definitionally correct at a glance. We'll show experimentally that it's equivalent to the direct formula we'll derive below.

While Kunimune's software has had the closed-form inverse for years, it's still missing from every industry-dominant library that downstream tools depend on. A significant purpose of this post is to describe the closed-form and motivate replacing the iterative method with it.

## The Aitoff Projection

Throughout the rest of this post, $\varphi$ denotes latitude in radians $[-\tfrac{\pi}{2}, \tfrac{\pi}{2}]$ and $\lambda$ denotes longitude in radians $[-\pi, \pi]$.

A forward projection function takes as its input a latitude and longitude, in units of either degrees or radians. This pair of numbers is also called a spherical coordinate. The projection transforms this coordinate into an $x/y$ coordinate in planar space, the range of $x$ and $y$ being unique to each projection.

For Aitoff, this function is defined via three equations:

$$
\begin{aligned}
\alpha &= \arccos\!\bigl(\cos\varphi \cdot \cos\tfrac{\lambda}{2}\bigr)
\\
\qquad x &= 2\cos\varphi \cdot \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha}
\\
\qquad y &= \sin\varphi \cdot \frac{\alpha}{\sin\alpha}
\end{aligned}
$$

When implementing for computer processing, it can be important to guard against the singularity as $\sin \alpha$ approaches zero. Since the range of $\arccos$ is $[0, \pi]$, we don't have to worry about $\sin \alpha$ hitting $0$ anywhere except when $\alpha=0$. Thus, an easy guard is just to check that $\alpha$ is 'close' to zero; we choose a value of 'close' that works with the 32-bit floating point numbers used in WebGPU.

### Whence?

The Aitoff projection is based on an equatorial aspect of the azimuthal equidistant projection. However, the equations above first halve the longitudes, and then double the results in the x-dimension. This transformation loses the equidistant property, but makes the map much more intuitive for visualizing landmasses and doesn't smear the Pacific Ocean around the whole globe.

This construction is what makes the closed-form inverse possible. Azimuthal equidistant has a well-known closed-form inverse, mostly polar-coordinate trig. Aitoff is "AE applied to $(\varphi, \lambda/2)$ with $x$ doubled," so the inverse should "just" be "undo the $x$ doubling, run AE inverse, double the longitude." That's the structural read Kunimune's library encodes. What we'll derive below is the same idea written as an algebraic identity, which leads to a more direct, compact, and performant solution.

{% include figure.html
     src="/assets/posts/aitoff-inverse/flatsphere-azimuthal-equidistant-lat0-lon180.png"
     alt="Equatorial aspect of the Azimuthal Equidistant projection, showing how the Pacific Ocean is smeared around the edge of the map."
     caption="The equatorial aspect of the Azimuthal Equidistant projection. Notice how one point in the Pacific Ocean is smeared around the edge of the map."
     width="1200" height="600" %}

{% include figure.html
     src="/assets/posts/aitoff-inverse/flatsphere-aitoff-lat90-lon180.png"
     alt="Standard Aitoff projection, showing bigger landmasses and Pacific Ocean only on the left/right sides of the map."
     caption="The Aitoff projection has clearer landmasses and the Pacific Ocean is only on the left and right sides of the map."
     width="1200" height="600" %}

## Deriving the Inverse

The inverse projection function takes an $x/y$ planar coordinate and transforms it back into the spherical coordinate (latitude and longitude) we supplied above. We are only concerned about values within the range of the forward projection, which for Aitoff is:

$$
\begin{aligned}
x &\in [-\pi,\pi]
\\
y &\in [-\pi/2,\pi/2]
\end{aligned}
$$

The common factor $A = \frac{\alpha}{\sin \alpha}$ appears in both forward coordinates, allowing us to momentarily simplify with a substitution:

$$
\begin{aligned}
\qquad x &= 2\cos\varphi \cdot \sin\tfrac{\lambda}{2} \cdot A
\\
\qquad y &= \sin\varphi \cdot A
\end{aligned}
$$

We'd like to use some trig identities, which is straightforward to do by squaring both equations and adding them together. We isolate the doubling factor of the $x$-equation prior to squaring so that it doesn't interfere with our trig identity goals.

$$
\left(\tfrac{x}{2}\right)^2 + y^2 = A^2 \cdot \Bigl(\cos^2\varphi \cdot \sin^2\tfrac{\lambda}{2} + \sin^2\varphi\Bigr)
$$

Now that the trig operations are isolated (in the brackets) we can transform the bracketed term using a couple standard identities. Noticing that $\alpha$ is defined in terms of cosine, we choose to replace $\sin^2\tfrac{\lambda}{2}$ with $1 - \cos^2\tfrac{\lambda}{2}$, and $\sin^2\varphi$ with $1 - \cos^2\varphi$.

$$
\begin{aligned}
&\cos^2\varphi \cdot \sin^2\tfrac{\lambda}{2} + \sin^2\varphi
\\
&\equiv \cos^2\varphi - \cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2} + \sin^2\varphi
\\
&\equiv 1 - \cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2}
\end{aligned}
$$

We then apply our definition of $\alpha$, or rather $\cos\alpha$, which allows us to replace $\cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2}$ with $\cos^2\alpha$.

$$
\begin{aligned}
& 1 - \cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2}
\\
& \equiv 1 - \cos^2\alpha
\\
& \equiv \sin^2\alpha
\end{aligned}
$$

We can now substitute $\sin^2\alpha$ back in for the original bracketed factor in the combined equation, and simplify further by re-expanding $A$ and another trig identity:

$$
\begin{aligned}
& A^2 \cdot \sin^2\alpha
\\
& \equiv \tfrac{\alpha^2}{\sin^2\alpha} \cdot \sin^2\alpha
\\
& \equiv \alpha^2
\end{aligned}
$$

Leaving us with:

$$
\left(\tfrac{x}{2}\right)^2 + y^2 = \alpha^2
$$

And allowing us to define $\alpha$ in terms of $x$ and $y$, and since $\alpha \geq 0$ by definition, we have

$$
\alpha = \sqrt{(x/2)^2 + y^2}
$$

So now we know the definition of $\alpha$ both in terms of $\lambda$/$\varphi$ and $x/y$, which allows us to define the inverse. First, we straightforwardly derive the latitude:

$$
\begin{aligned}
y &= \sin\varphi \cdot \frac{\alpha}{\sin\alpha} \implies
\\
\frac{y \sin\alpha}{\alpha} &= \sin\varphi \implies
\\
\arcsin \frac{y \sin\alpha}{\alpha} &= \varphi
\end{aligned}
$$

The longitude component is more complex to derive as it is defined in terms of two variables. We need a second equation to eliminate one of them. Looking at the original definition of $\alpha$, we can rearrange it to isolate the latitude component in terms of $\alpha$ and the longitude component:

$$
\cos\varphi = \tfrac{\cos\alpha}{\cos\tfrac{\lambda}{2}}
$$

Replacing $\cos\varphi$ in the definition of $x$ allows us to isolate the longitude $\lambda$:

$$
\begin{aligned}
x &= 2\cos\varphi \cdot \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha} \implies
\\
x &= 2\frac{\cos\alpha}{\cos\tfrac{\lambda}{2}} \cdot \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha} \implies
\\
\frac{x\sin\alpha}{2\alpha\cos\alpha} &= \frac{\sin\tfrac{\lambda}{2}}{\cos\tfrac{\lambda}{2}} \implies
\\
\frac{x\sin\alpha}{2\alpha\cos\alpha} &= \tan\frac{\lambda}{2} \implies
\\
2\arctan\frac{x\sin\alpha}{2\alpha\cos\alpha} &= \lambda
\end{aligned}
$$

However, note that our rewrite above has a sneaky condition: $\cos\varphi$ is only valid where $\cos\tfrac{\lambda}{2} \neq 0$, i.e. off the antipodal arc $\lambda = \pm\pi$. This can be resolved by using the two-argument form `atan2` in code, which returns results in the correct quadrant and is well-defined when the second argument is zero.

`lon = 2 * atan2(x * sin(alpha), 2 * alpha * cos(alpha))`

We need a further guard to make sure both latitude and longitude are sound at the planar origin. The sharp-eyed reader will notice that the latitude is undefined when $\alpha = 0$, and given our definition of $\alpha$ in terms of $x$ and $y$ derived above, that's exactly when both $x = y = 0$. This case can only be handled by an `if`-statement after calculating `alpha` in the inverse function. The full function in pseudo-code looks like:

```
α = sqrt((x/2)² + y²)
if α = 0:
    return (φ, λ) = (y, x)
sinα = sin(α)
φ = arcsin( y · sinα / α )
λ = 2 · atan2( (x/2) · sinα, α · cos(α) )
return (φ, λ)
```

In practice, with floating-point numbers, one needs to check that $\alpha$ is less than some threshold because [floating-point comparison is sketchy](https://floating-point-gui.de/errors/comparison/).

## Inverting the Inverse

To check that our inverse derivation is correct, we can start from the inverse formulas and recover the original forward projection. This is fairly straightforward now that we have $\alpha$ defined in terms of both $x$/$y$ and $\varphi$/$\lambda$.

The latitude equation rearranges directly back to the forward $y$:

$$
\begin{aligned}
\sin\varphi &= \frac{y \sin\alpha}{\alpha} \implies
\\
\frac{\alpha \sin\varphi}{\sin\alpha} &= y \implies
\\
\sin\varphi \cdot \frac{\alpha}{\sin\alpha} &= y
\end{aligned}
$$

The longitude equation needs the same substitution tactic we used earlier, just running the other way. Expand $\tan\frac{\lambda}{2}$ into $\sin\frac{\lambda}{2} / \cos\frac{\lambda}{2}$, then substitute $\cos\frac{\lambda}{2} = \frac{\cos\alpha}{\cos\varphi}$ to swap the half-longitude cosine for $\alpha$ and $\varphi$ — the same rearranged $\alpha$ relation we used in the forward derivation, just applied to a different term:

$$
\begin{aligned}
\frac{x \sin\alpha}{2\alpha\cos\alpha} &= \frac{\sin\tfrac{\lambda}{2}}{\cos\tfrac{\lambda}{2}} \implies
\\
\frac{x \sin\alpha}{2\alpha\cos\alpha} &= \frac{\sin\tfrac{\lambda}{2}}{\cos\alpha / \cos\varphi} \implies
\\
\frac{x \sin\alpha}{2\alpha\cos\alpha} &= \frac{\sin\tfrac{\lambda}{2} \cdot \cos\varphi}{\cos\alpha} \implies
\\
\frac{x \sin\alpha}{2\alpha\cos\varphi} &= \sin\tfrac{\lambda}{2} \implies
\\
x &= 2\cos\varphi \cdot \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha}
\end{aligned}
$$

We've recovered the forward projection $x$ equation. Thus, the inverse formulas can be used to recover the forward formulas exactly, with the same caveats around the antipodal arc and the poles that we already noted.

## Numerical Comparison

To check that the closed-form inverse behaves correctly under standard double-precision arithmetic and matches the established iterative implementations, I had the same AI agent build three independent comparison harnesses, one each in JavaScript, C, and Python. Each compares the closed-form against a different iterative reference:

| Harness | Iterative reference | Iterative method |
|---|---|---|
| JavaScript | [`d3-geo-projection`](https://github.com/d3/d3-geo-projection) 4.0.0 | 25-iteration Newton–Raphson with hand-coded Jacobian |
| C | [PROJ](https://proj.org/) 9.8.1 (direct C-API) | Nested Newton–Raphson (inner 10, outer 20 rounds), per Bildirici–İpbüker 2002 |
| Python | [`pyproj`](https://pyproj4.github.io/pyproj/stable/) 3.7.2 (PROJ 9.5.1 bundled) | Same as PROJ, via the Python bindings |

All three harnesses sample the same 5,151-point grid spanning the Aitoff ellipse with a 2 % stand-off from the boundary, forward-project each point, run both the closed-form and the iterative inverse on the result, and record the per-point disagreement. The full harness lives at [github.com/glossopoeia/aitoff-closed-form](https://github.com/glossopoeia/aitoff-closed-form).

The results indicate good equivalence, and better numerical behavior at the extremities vs d3-geo:

| Harness | Interior max error (rad) | Boundary max error (rad) | Branch-drift points |
|---:|---:|---:|---:|
| JavaScript vs d3-geo | $2.1 \times 10^{-12}$ | $0.68$ | 132 |
| C vs PROJ            | $4.9 \times 10^{-15}$ | $2.1 \times 10^{-14}$ | 0 |
| Python vs pyproj     | $4.0 \times 10^{-15}$ | $2.1 \times 10^{-14}$ | 0 |

In the interior 95 % or so of the Aitoff ellipse, every comparison is at machine precision, i.e. the closed-form and the iterative reference agree to within the smallest representable difference. Both methods are computing the same well-conditioned function on a region where it's smooth.

The boundary numbers tell a more interesting story. d3-geo's flat Newton–Raphson drifts to a non-canonical longitude near the antipodal arc in 132 of 5,151 grid points, around 2.5 %. PROJ's nested Newton–Raphson validates each candidate in the outer loop and retries with an improved guess if a round-trip projection exceeds the tolerance. As a result, it shows zero drift across the same grid. It is important to note that both d3-geo's result and ours are *mathematically* correct, but the closed-form's `atan2` keeps its output in the expected $[-\pi, \pi]$ forward domain by construction, while d3-geo's iterate can wander.

The harness also runs each implementation's algebraic identity against Kunimune's structural version on the same grid, to confirm they agree pointwise. They do, to about $1.4 \times 10^{-14}$ rad (about as close as IEEE-754 double-precision numbers can get) across all 5,151 points in every language. The two formulations are computing the same closed-form function, just by different routes.

We already see that either expression of the closed form has some real benefits when compared to the iterative methods. Compared to d3-geo specifically, it's marginally more robust at the boundary, and it matches PROJ's robustness while doing the work in five transcendental calls instead of a Newton loop.

## Performance

The other tantalizing benefit of a closed-form inverse is speed. In the example repository, each language's harness also includes a wall-clock benchmark that times the inverse computation one coordinate pair at a time across the 5,151-point grid, multi-trial, with the minimum reported. All the numbers below are from my Apple M2 with `-O2` optimization, PROJ 9.8.1, Node 26.3, Python 3.14.6 with pyproj 3.7.2 (bundled PROJ 9.5.1). Trial-to-trial variation is under 2% on the closed-form rows and under 8% on the iterative rows across re-runs.

The C numbers are the most direct comparison since PROJ is C:

| Method | Per-call time | Ratio vs PROJ |
|---|---:|---:|
| Closed-form, algebraic identity | **48 ns** | **14.8× faster** |
| Closed-form, Kunimune structural decomposition | 71 ns | 10.0× faster |
| PROJ iterative Newton–Raphson | 711 ns | 1.0× baseline |

JavaScript is similar, though d3-geo's flat single-loop Newton–Raphson is meaningfully cheaper per call than PROJ's nested implementation (no outer-loop validation, no `PJ_COORD` boxing). The ratio compresses, but the closed-form still wins:

| Method | Per-call time | Ratio vs d3-geo |
|---|---:|---:|
| Closed-form, algebraic | **61 ns** | **8.3× faster** |
| Closed-form, Kunimune | 96 ns | 5.3× faster |
| d3-geo-projection iterative | 508 ns | 1.0× baseline |

Python is the interesting case, because the answer depends on how you call the inverse. A basic Python loop over the function call is dominated by interpreter overhead regardless of which method is used, so the ratio compresses to about 3×. The numpy-vectorized closed-form, on the other hand, processes the whole grid as one array operation and matches C-native performance almost exactly:

| Method | Per-call time | Ratio vs pyproj |
|---|---:|---:|
| *Per-call (scalar inputs, Python loop):* | | |
| Closed-form algebraic (scalar) | **636 ns** | **3.0× faster** |
| pyproj iterative (scalar call) | 1,901 ns | 1.0× baseline |
| *Vectorized (numpy arrays passed once):* | | |
| Closed-form algebraic (numpy) | **48 ns** | **15.1× faster** |
| pyproj iterative (array call) | 724 ns | 1.0× baseline |

Across all implementations except the basic Python loop, the closed-form / iterative ratio sits between 8× and 15×. It's a consistent speed-up across three quite different optimized runtimes, which is reassuring.

Kunimune's implementation results are also stable across languages: the structural decomposition lands at roughly 1.5× the algebraic time everywhere. Both forms produce almost identical outputs. The algebraic identity boils the inverse down to one `sqrt` and four trig functions, while the structural decomposition routes through a full spherical rotation between the polar and equatorial frames, costing about three extra trig calls. Both are substantially faster than the iterative methods.

A speedup of a few nanoseconds is hard to get excited about. In practice, this matters anywhere an inverse projection gets called once per pixel or once per coordinate. A 4K × 2K Aitoff raster reprojected to e.g. equirectangular is *8.4 million inverse calls*. By these numbers, PROJ's iterative implementation takes about 6 seconds of inverse work per raster, certainly not interactive and scaling linearly for batch jobs. With the closed-form, it takes about 0.4 seconds, which enables quicker-updating previews even without a GPU. The same proportional gain applies to cartopy and GeoPandas batch reprojection, vector-tile servers, and anything else that does interactive Aitoff display.

These benchmarks are reproducible from a clean clone with `make bench` at the repo root. Full per-trial numbers, methodology, and caveats are in the [repo README's Performance section](https://github.com/glossopoeia/aitoff-closed-form#performance).

## Implications

Once the closed-form Aitoff was in hand, I poked at a couple of nearby projections to see whether the same approach extended. The two immediate candidates were the [Winkel Tripel]({% link _projections/winkel-tripel.md %}) and the [Wagner IX]({% link _projections/wagner-ix.md %}), because they're based on the Aitoff projection.

### Winkel Tripel: No Go

It was a bit crushing that the Winkel Tripel attempt didn't pan out as a full closed-form, but the failure is interesting enough to be worth writing down. Winkel Tripel is the arithmetic mean of Aitoff and an equirectangular projection at standard parallel $\varphi_1 = \arccos(2/\pi)$:

$$
\begin{aligned}
x_{WT} &= \tfrac{1}{2}(x_A + \tfrac{2\lambda}{\pi})
\\
y_{WT} &= \tfrac{1}{2}(y_A + \varphi)
\end{aligned}
$$

Just as before, the inverse problem here is to recover $(\varphi, \lambda)$ given the planar coordinates — only this time the planar coordinates are $(x_{WT}, y_{WT})$ rather than Aitoff's $(x_A, y_A)$. Solving the two WT equations above for the Aitoff terms gives $x_A = 2x_{WT} - 2\lambda/\pi$ and $y_A = 2y_{WT} - \varphi$. The natural next move is to drop those into the identity that made Aitoff closed-form, $(x_A/2)^2 + y_A^2 = \alpha^2$, and hope it hands us $\alpha$ directly in terms of $(x_{WT}, y_{WT})$.

It doesn't, because the substitution drags $\varphi$ and $\lambda$ — the very quantities we're trying to solve for — onto the right-hand side:

$$
\alpha = \sqrt{\bigl(x_{WT} - \lambda/\pi\bigr)^2 + (2y_{WT} - \varphi)^2}
$$

For Aitoff, the inputs $(x_A, y_A)$ and the unknowns $(\varphi, \lambda)$ stayed cleanly separated and the identity isolated $\alpha$ entirely on the input side. For Winkel Tripel, the equirectangular term leaks the unknowns into the formula for $\alpha$ itself, so we'd need to know $(\varphi, \lambda)$ before we could compute the very quantity that's supposed to recover them. The resulting two-equation system seems genuinely coupled and I ran out of patience trying to pull it apart. Kunimune apparently ran into the same wall — his `WinkelTripel.java` opens with a candid comment:

> *I tried solving for these equations myself, and I think I got them mostly right, but the expressions were just too complicated. I got better results by transcribing the below equations from Ipbüker and Bildirici's paper...*

I tried a few iterative approaches with the closed-form Aitoff as the inner step. None were robust enough to replace Newton-Raphson on the full Winkel Tripel domain. So, Winkel Tripel has to remain iterative, for now.

### Wagner IX: A Clean Win

Wagner IX is the cleaner result. It's a direct modification of Aitoff by Karlheinz Wagner in 1949, designed to give the poles a finite line instead of collapsing them to a point. The construction pre-scales latitude and longitude before applying Aitoff:

$$
\begin{aligned}
\varphi' &= \arcsin(m \sin\varphi)
\\
\lambda' &= n\lambda
\\
(x, y) &= (s_x, s_y) \cdot \mathrm{Aitoff}(\varphi', \lambda')
\end{aligned}
$$

for fixed Wagner constants $m, n, s_x, s_y$. Each piece is closed-form on its own, so the inverse is derived straightforwardly: undo the output scaling, apply the closed-form Aitoff inverse, undo the input scaling.

Wagner IX isn't widely shipped, so the value found here is less obvious. But it is one demonstration of why the closed-form Aitoff is useful as a building block: anywhere Aitoff appears as a component of another projection, the closed-form replacement either improves the surrounding code directly or improves the inner step of whatever iteration remains.

## Conclusion

This sidebar ended up consuming way more time than I expected. It was a rabbit hole for sure, but the deeper I dug the more fascinated I was by the history of the Aitoff and Hammer projections, and how they're confused even today thanks to their visual similarity and intertwined origins. I find the Hammer projection the most pleasing of the two, but I appreciate the simple elegance of Aitoff's original construction, even more so now that I know about the closed-form inverse. And finding that closed-form inverse has netted real performance results for Flatsphere already while matching existing implementations' accuracy. Thanks to this investigation, I'll be making a PR to PROJ to suggest using the closed-form inverse.