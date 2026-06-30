---
title: A Closed-Form Inverse for the Aitoff Projection
excerpt: "The Aitoff projection's inverse is widely treated as an iterative-only problem in modern cartographic software. I was surpised to find that there's a closed-form solution with good numeric properties. A short derivation gives a non-iterative formula that matches Newton–Raphson to machine precision on the interior of the projection's domain and improves on it near the antipodes."
math: true
---

This is a story of how recent AI tools helped me re-discover a cleaner method for computing the inverse of a one-hundred and thirty year old projection. While the Aitoff projection isn't terribly popular (you're probably better off using Hammer in most applicable scenarios), this re-discovery helps correct the record, and was the most intriguing experience I've had to data with one of the brand name LLMs.

**For the non-technical audience**: a closed-form equation (of the kind you're familiar with from high school or college math) is often more efficient to compute than an 'iterative solution' for a given mathematical function. For the latter, you have to compute the same set of steps multiple times, using the approximated result from the last round to generate a better estimate. Usually, the higher the number of rounds you iterate, the better the approximate result. But a closed-form solution often has many benefits compared to the approximation: 1) the set of steps only gets computed once, 2) the solution is often more accurate for less work, and 3) even when it's not more accurate, it sometimes has better numerical 'behavior' compared to a result arrived at iteratively.

So, the fact that the Aitoff projection has a closed-form inverse that no one is using means there's opportunity for improvement!

## Background

The Aitoff projection is a compromise projection first characterized in the late 1800's by David Aitoff. It looks very similar to, and was invented just shortly before, the much better known Hammer (or Hammer-Aitoff) projection. The Hammer projection has the nice property of being equal area, while the original Aitoff projection, based on the azimuthal equidistant projection, ends up preserving no cartographic properties. Hammer's work was used much more throughout the 20th century, but was often mistakenly attributed Aitoff (even by [NASA](https://asd.gsfc.nasa.gov/archive/idlastro/ftp/pro/astro/aitoff.pro)!) due to the two projections' visual similarity and Hammer's careful citation of Aitoff's work as his inspiration.

I myself fell into this trap when reimplementing both of these projections for Flatsphere. On my first attempt I found an incorrect method for the inverse Aitoff projection, that was really just another form of the inverse Hammer projection. When I was testing the projections, swapping between them to inspect the difference, I found that they were almost pixel-by-pixel the same. It was then that I uncovered several papers teasing out the continuing history of misattribution, and decided to employ our great new tool, the Large-Language Model, to help sift through all the variations and implement a proper Aitoff.

It didn't take long for Claude Opus 4.7 to find the usual method for inverting the projection using a standard Newton-Raphson iterative technique. I already had a decently-performant iterative inverse implemented on the GPU for the Mollweide projection, so I referred Claude to that to help me scaffold it out. I then got a very surprising response:

> Good feedback. Let me first verify the proper Aitoff inverse approach — Aitoff actually DOES have a closed-form inverse (contrary to common belief, but it's derivable from the fact that Aitoff is equatorial azimuthal-equidistant of (lat, lon/2)). Let me verify before coding.

Because I hadn't instructed it to look for a closed-form inverse, I was surprised that it brought it up. I asked it if it derived that inverse itself or if it had pulled it from some buried part of its training data. It went and checked the broader online cartography literature and source code for sources, but ended up finding that pretty much everyone uses the iterative method. Then Claude hit me with this line, followed shortly by an explanatory paragraph:

> Honest answer: I derived it from first principles in this conversation. But the idea shouldn't be surprising — it follows directly from Aitoff's definition.

> **What the literature says.** I checked PROJ, d3-geo, the Wikipedia article, and Google Scholar. PROJ explicitly cites Bildirici & Ipbüker 2002 ("A General Algorithm for the Inverse Transformation of Map Projections Using Jacobian Matrices") and uses nested Newton-Raphson loops. d3-geo also iterates (25 rounds with hand-coded partial derivatives). Wikipedia's Aitoff article doesn't mention an inverse at all. Bildirici-Ipbüker treat Aitoff as a worked example for their general iterative method. The one Scholar hit mentioning "Aitoff equal-area" with closed-form relations (Jackson & Bloxham 1991) is almost certainly Hammer-Aitoff (i.e., Hammer), which everyone knows is closed-form.

This was the most fascinating interaction I've had with an AI agent to date (in truth, most interactions are bog standard while also being incredibly convenient). To me, this singular chat bordered on true creativity: the agent was instructed to perform a task, even in a certain way, but immediately noticed a more efficient technique and suggested that instead. It did this, so it claims, without having that answer directly baked into it's training data.

The story got more interesting still when, a little later, we widened the literature check beyond PROJ and d3-geo. It turns out [Justin Kunimune's *Map-Projections*](https://github.com/jkunimune/Map-Projections) — the well-regarded Java projection library that Flatsphere itself is descended from — has had a closed-form Aitoff inverse since at least 2017. He doesn't call it that, and he doesn't write down the algebraic identity. He writes it *structurally*: apply the polar azimuthal-equidistant inverse to $(x/2, y)$, then run the result through an oblique transformation that rotates the polar pole to the equator, then double the longitude. That's three lines of Java that, when you trace the math, are equivalent to the formula we'll derive below. Same answer, different presentation.

That changes the framing of this post but not the conclusion. The closed-form is not as undiscovered as I first thought — one specialist library has been quietly using it for years — but it *is* missing from every industry-dominant library that downstream tools (pyproj, GeoPandas, Cartopy, QGIS, every Python and JavaScript mapping tool) actually rely on. The algebraic identity formulation also seems genuinely new, in the sense that it makes the closed-form's existence obvious from the equations themselves rather than via a geometric decomposition the reader has to recognize. So the PRs are still worth filing, and the derivation below is still worth writing down. I just owe Kunimune a citation and an "amen" for having gotten there first.

### Conventions

Throughout the rest of this post, $\varphi$ denotes latitude in radian $[-\tfrac{\pi}{2}, \tfrac{\pi}{2}]$ and $\lambda$ denotes longitude in radians $[-\pi, \pi]$.

## The Aitoff Projection

A forward projection function takes as its input a latitude and longitude, in either units of degrees or radians. This pair of number is also called a spherical coordinate. The projection transforms this coordinate into an x/y coordinate in planar space, the range of x and y being unique to each projection.

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

This AE-based construction is what makes a closed-form inverse possible at all. Azimuthal equidistant has a famous, well-known closed-form inverse — it's the projection where Euclidean radius from the projection center equals great-circle distance, so the inverse is mostly just polar-coordinate trig. Aitoff is "AE applied to $(\varphi, \lambda/2)$ with $x$ doubled," so the inverse should "just" be "undo the $x$ doubling, run AE inverse, double the longitude." That structural read is exactly the recipe Kunimune's library uses, and what we'll derive below is the same recipe expressed as an algebraic identity instead. Both are closed-form; the algebraic version lets us see *why*, with one short trig identity rather than a geometric decomposition into a different projection.

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

The inverse projection function takes an x/y planar coordinate and transforms it back into the spherical coordinate (latitude and longitude) we supplied above. We are only concerned about values within the range of the forward projection, which for Aitoff is:

$$
x \in [-\pi,\pi]
\\
y \in [-\pi/2,\pi/2]
$$

The common factor $A = \tfrac{\alpha}{\sin \alpha}$ appears in both forward coordinates, allowing us to momentarily simplify with a substitution:

$$
\begin{aligned}
\qquad x &= 2\cos\varphi \cdot \sin\tfrac{\lambda}{2} \cdot A
\\
\qquad y &= \sin\varphi \cdot A
\end{aligned}
$$

We'd like to use some trig identities, which is straightforward to do by squaring both and adding the system of equations together. We isolate the doubling factor of the $x$-equation prior to squaring so that it doesn't interfere with our trig identity goals.

$$
\left(\tfrac{x}{2}\right)^2 + y^2 = A^2 \cdot \Bigl(\cos^2\varphi \cdot \sin^2\tfrac{\lambda}{2} + \sin^2\varphi\Bigr)
$$

Now that the trig operations are isolated (in the brackets) we can transform the bracketed term using a couple standard identities. Noticing that $\alpha$ is defined in terms of $\cos$, we choose to replace $\sin^2\tfrac{\lambda}{2}$ with $1 - \cos^2\tfrac{\lambda}{2}$, and $\sin^2\varphi$ with $1 - cos^2\varphi$.

$$
\cos^2\varphi \cdot \sin^2\tfrac{\lambda}{2} + \sin^2\varphi \equiv
\\
\cos^2\varphi - \cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2} + \sin^2\varphi \equiv
\\
1 - \cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2}
$$

We then apply our definition of $\alpha$, or rather $\cos\alpha$, which allows us to replace $\cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2}$ with $\cos^2\alpha$.

$$
1 - \cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2}
\\
1 - \cos^2\alpha
\\
\sin^2\alpha
$$

We can now substitute $\sin^2\alpha$ back in for the original bracketed factor in the combined equation, and simplify further by re-expanding $A$ and another trig identity:

$$
A^2 \cdot \sin^2\alpha \equiv
\\
\tfrac{\alpha^2}{\sin^2\alpha} \cdot \sin^2\alpha \equiv
\\
\alpha^2
$$

Leaving us with:

$$
\left(\tfrac{x}{2}\right)^2 + y^2 = \alpha^2
$$

And allowing us to define $\alpha$ in terms of $x$ and $y$, and since $\alpha \geq 0$ by definition, we have

$$
\alpha = \sqrt{(x/2)^2 + y^2}
$$

So now we know the definition of $\alpha$ both in terms of $\lambda$/$\varphi$ and x/y, which allows us to define the inverse. First, we straightforwardly derive the latitude:

$$
\begin{aligned}
y &= \sin\varphi \cdot \frac{\alpha}{\sin\alpha} \to
\\
\frac{y \sin\alpha}{\alpha} &= \sin\varphi \to
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
x &= 2\cos\varphi \cdot \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha} \to
\\
x &= 2\frac{\cos\alpha}{\cos\tfrac{\lambda}{2}} \cdot \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha} \to
\\
\frac{x\sin\alpha}{2\alpha\cos\alpha} &= \frac{\sin\tfrac{\lambda}{2}}{\cos\tfrac{\lambda}{2}} \to
\\
\frac{x\sin\alpha}{2\alpha\cos\alpha} &= \tan\frac{\lambda}{2} \to
\\
2\arctan\frac{x\sin\alpha}{2\alpha\cos\alpha} &= \lambda
\end{aligned}
$$

However, note that our rewrite above has sneaky condition: $\cos\varphi$ is only valid where $\cos\tfrac{\lambda}{2} \neq 0$, i.e. off the antipodal arc $\lambda = \pm\pi$. This can be resolved by using the two-argument form `atan2` in code, which returns results in the correct quadrant and is well-defined when the second argument is zero.

`lon = 2 * atan2(x * sin(alpha), 2 * alpha * cos(alpha))`

We need a further guard to make sure both latitude and longitude are sound at the planar origin. The sharp-eyed reader will notice that the latitude will become undefined when $\alpha = 0$, and given our definition of $\alpha$ in terms of $x$ and $y$ derived above, that exactly when both $x = y = 0$. This case can only be handled by an `if`-statement after calculating `alpha` in the inverse function. The full function in psuedo-code looks like:

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

To feel even more assured that our inverse derivation is correct, we can start from the inverse formulas and recover the original forward projection. This ends up being fairly straightforward, especially now that we have $\alpha$ defined in terms of both $x$ and $y$ as well as latitude and longitude.

The latitude equation rearranges directly back to the forward $y$:

$$
\begin{aligned}
\sin\varphi &= \frac{y \sin\alpha}{\alpha} \to
\\
\frac{\alpha \sin\varphi}{\sin\alpha} &= y \to
\\
\sin\varphi \cdot \frac{\alpha}{\sin\alpha} &= y
\end{aligned}
$$

The longitude equation needs the same substitution tactic we used earlier, just running the other way. Expand $\tan\tfrac{\lambda}{2}$ into $\sin\tfrac{\lambda}{2} / \cos\tfrac{\lambda}{2}$, then substitute $\cos\tfrac{\lambda}{2} = \tfrac{\cos\alpha}{\cos\varphi}$ to swap the half-longitude cosine for $\alpha$ and $\varphi$ — the same rearranged $\alpha$ relation we used in the forward derivation, just applied to a different term:

$$
\begin{aligned}
\frac{x \sin\alpha}{2\alpha\cos\alpha} &= \frac{\sin\tfrac{\lambda}{2}}{\cos\tfrac{\lambda}{2}} \to
\\
\frac{x \sin\alpha}{2\alpha\cos\alpha} &= \frac{\sin\tfrac{\lambda}{2}}{\cos\alpha / \cos\varphi} \to
\\
\frac{x \sin\alpha}{2\alpha\cos\alpha} &= \frac{\sin\tfrac{\lambda}{2} \cdot \cos\varphi}{\cos\alpha} \to
\\
\frac{x \sin\alpha}{2\alpha\cos\varphi} &= \sin\tfrac{\lambda}{2} \to
\\
x &= 2\cos\varphi \cdot \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha}
\end{aligned}
$$

That's the forward $x$. The inverse formulas recover the forward formulas exactly, with the same caveats around the antipodal arc and the poles that we already noted.

## Numerical Comparison

Algebra is one thing; floating-point arithmetic is another. To check that the closed-form inverse behaves correctly under standard double-precision arithmetic — and to confirm it matches the established iterative implementations — I built three independent comparison harnesses, one each in JavaScript, C, and Python. Each compares the closed-form against a different iterative reference:

| Harness | Iterative reference | Iterative method |
|---|---|---|
| JavaScript | [`d3-geo-projection`](https://github.com/d3/d3-geo-projection) 4.0.0 | 25-iteration Newton–Raphson with hand-coded Jacobian |
| C | [PROJ](https://proj.org/) 9.8.1 (direct C-API) | Nested Newton–Raphson (inner 10, outer 20 rounds), per Bildirici–İpbüker 2002 |
| Python | [`pyproj`](https://pyproj4.github.io/pyproj/stable/) 3.7.2 (PROJ 9.5.1 bundled) | Same as PROJ, via the Python bindings |

All three harnesses sample the same 5,151-point grid spanning the Aitoff ellipse with a 2 % stand-off from the boundary, forward-project each point, run both the closed-form and the iterative inverse on the result, and record the per-point disagreement. The full harness — including pinned dependency versions so a reader running it after these patches land won't accidentally compare the closed-form against itself — lives at [github.com/glossopoeia/aitoff-closed-form](https://github.com/glossopoeia/aitoff-closed-form).

The headline result is what you'd hope:

| Harness | Interior max error (rad) | Boundary max error (rad) | Branch-drift points |
|---:|---:|---:|---:|
| JavaScript vs d3-geo | $2.1 \times 10^{-12}$ | $0.68$ | 132 |
| C vs PROJ            | $4.9 \times 10^{-15}$ | $2.1 \times 10^{-14}$ | 0 |
| Python vs pyproj     | $4.0 \times 10^{-15}$ | $2.1 \times 10^{-14}$ | 0 |

In the interior 95 % or so of the Aitoff ellipse, every comparison is at machine precision — the closed-form and the iterative reference agree to within the smallest representable difference. Both methods are computing the same well-conditioned function on a region where it's smooth.

The boundary numbers tell a more interesting story. d3-geo's flat Newton–Raphson sometimes drifts to a longitude in a non-canonical 2π-branch near the antipodal arc — 132 of 5,151 grid points, around 2.5 %. PROJ's nested Newton–Raphson (the outer loop validates each candidate by forward-projecting and retries with a refined starting guess if the round-trip exceeds tolerance) eliminates this entirely: zero drifts across the same grid. Both d3-geo's result and ours are *mathematically* correct — forward-projecting either one reproduces the input $(x, y)$ to within $10^{-15}$ — but the closed-form's `atan2` keeps its output in canonical $[-\pi, \pi]$ by construction, while d3-geo's iterate can wander.

So the closed-form isn't just an academic alternative to iteration. Compared to d3-geo specifically, it's also marginally more robust at the boundary; compared to PROJ, it matches PROJ's robustness while doing the work in five transcendental calls instead of a Newton loop. Both library teams would benefit from picking it up, which is the point of the PRs.

One additional cross-check the harness runs: each implementation runs *both* the algebraic identity and Kunimune's structural decomposition on the full grid and verifies they agree pointwise. They do, to about $1.4 \times 10^{-14}$ rad across all 5,151 points in every language. That's the noise floor of IEEE-754 double-precision arithmetic, not any meaningful difference. The two formulations are computing the same closed-form function, just by different routes. This is reassuring in two ways: it confirms my algebraic derivation matches Kunimune's working code (always nice when a derivation lands on something that's been in production for years), and it confirms his decomposition was right all along.

## Performance

Correctness is one thing; speed is the other thing the closed-form was hopefully going to give us. Each language's harness also includes a wall-clock benchmark that times the inverse one coordinate pair at a time across the same 5,151-point grid, multi-trial, minimum reported. (All numbers below are from an Apple M2 at `-O2`, PROJ 9.8.1, Node 26.3, Python 3.14.6 with pyproj 3.7.2 / bundled PROJ 9.5.1. Trial-to-trial variation is under 2 % on the closed-form rows and under 8 % on the iterative rows across re-runs.)

The C numbers — the most direct comparison, since PROJ is C — set the baseline:

| Method | Per-call time | Ratio vs PROJ |
|---|---:|---:|
| Closed-form, algebraic identity | **48 ns** | **14.8× faster** |
| Closed-form, Kunimune structural decomposition | 71 ns | 10.0× faster |
| PROJ iterative Newton–Raphson | 711 ns | 1.0× baseline |

JavaScript paints a similar picture, though d3-geo's flat single-loop Newton–Raphson is meaningfully cheaper per call than PROJ's nested implementation (no outer-loop validation, no `PJ_COORD` boxing). So the ratio compresses, but the closed-form still wins:

| Method | Per-call time | Ratio vs d3-geo |
|---|---:|---:|
| Closed-form, algebraic | **61 ns** | **8.3× faster** |
| Closed-form, Kunimune | 96 ns | 5.3× faster |
| d3-geo-projection iterative | 508 ns | 1.0× baseline |

Python is the most interesting one, because the answer changes depending on how you call the inverse. Per-call inside a Python loop is dominated by interpreter overhead regardless of which method you're invoking, so the ratio compresses to ~3×. But the numpy-vectorized closed-form processes the entire grid as one array operation and matches C-native performance almost exactly:

| Method | Per-call time | Ratio vs pyproj |
|---|---:|---:|
| *Per-call (scalar inputs, Python loop):* | | |
| Closed-form algebraic (scalar) | **636 ns** | **3.0× faster** |
| pyproj iterative (scalar call) | 1,901 ns | 1.0× baseline |
| *Vectorized (numpy arrays passed once):* | | |
| Closed-form algebraic (numpy) | **48 ns** | **15.1× faster** |
| pyproj iterative (array call) | 724 ns | 1.0× baseline |

Two things worth pointing out from the Python table. First, the vectorized closed-form (48 ns/call) matches the C-native closed-form (48 ns/call) to the digit — numpy's array operations on the inverse compile through the same SIMD-friendly inner-loop routines that C produces directly, and once the work is batched the Python interpreter overhead disappears. Second, the per-call Python row's 3× ratio is the one mode where the closed-form's algorithmic advantage doesn't dominate — but in that mode the right advice is to use the array API, not to use the iterative inverse.

Pulling the three languages together, the closed-form / iterative ratio clusters between 8× and 15× across C, V8-JIT'd JavaScript, and vectorized Python. The cross-language consistency is itself a useful signal: this isn't a microbenchmark artifact in one language, it's the same algorithmic advantage showing up wherever the inverse runs.

The Kunimune-row gap is also stable across languages: structural decomposition lands at roughly 1.5× the algebraic time everywhere. Both forms are closed-form and both produce identical outputs; the algebraic identity boils the inverse down to one `sqrt`, one `sin`, one `cos`, one `arcsin`, and one `atan2`, while the structural decomposition does the same conceptually but routes through a 3D Cartesian rotation between the polar and equatorial AE frames, costing an extra `sin`, `cos`, and `arcsin`. Both are still dramatically faster than iteration. So the practical pitch for Kunimune's library is "this is already what you have"; the pitch for PROJ and d3-geo is "this could be what you have, in either the structural form Kunimune already proved out or the slightly tighter algebraic form."

Where it matters in practice: anywhere an inverse projection gets called once per pixel or once per coordinate. A 4K × 2K Aitoff raster reprojected to plate carrée is 8.4 million inverse calls. With PROJ's iterative implementation that's about 6 seconds of inverse work per frame; with the closed-form (whether called from C, from numpy in Python, or eventually from V8 in a web map renderer) it's about 0.4 seconds. The same proportional gain applies to cartopy and GeoPandas batch geometry reprojection, to vector-tile servers, and to anything that does interactive Aitoff display.

Reproducible from a clean clone with `make bench` at the repo root. The full per-trial numbers, methodology, and caveats live in the [aitoff-closed-form repo README's Performance section](https://github.com/glossopoeia/aitoff-closed-form#performance).