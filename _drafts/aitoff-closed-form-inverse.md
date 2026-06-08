---
title: A Closed-Form Inverse for the Aitoff Projection
excerpt: "The Aitoff projection's inverse is widely treated as an iterative-only problem in modern cartographic software. It isn't. A short derivation gives a non-iterative formula that matches Newton–Raphson to machine precision on the interior of the projection's domain and improves on it near the antipodes."
math: true
---

The Aitoff projection has an exact, non-iterative inverse. This appears to be little-known: the two most widely used open-source projection libraries —[PROJ](https://proj.org/) and [d3-geo](https://github.com/d3/d3-geo-projection) — both implement the inverse with Newton–Raphson iteration, and the Wikipedia article on the Aitoff projection does not give an inverse at all. The derivation is short, follows directly from David Aitoff's 1889 definition of the projection in terms of the azimuthal-equidistant projection, and the resulting formula matches the iterative implementations to machine precision wherever the iterations converge, and is more robust where they don't.

This post derives the closed form, shows that the forward projection can be recovered from it (so the pair forward/inverse is genuinely mutual), and reports a numerical comparison against d3-geo's implementation across the full Aitoff domain.

## Setup and forward projection

Throughout, $\varphi$ denotes latitude in $[-\tfrac{\pi}{2}, \tfrac{\pi}{2}]$ and $\lambda$ denotes longitude in $[-\pi, \pi]$. The Aitoff forward projection produces planar coordinates $(x, y)$ via

$$
\alpha = \arccos\!\bigl(\cos\varphi \cdot \cos\tfrac{\lambda}{2}\bigr), \qquad x = 2\cos\varphi \cdot \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha}, \qquad y = \sin\varphi \cdot \frac{\alpha}{\sin\alpha}.
$$

The factor $\alpha/\sin\alpha$ is understood to take its limit value $1$ when $\alpha = 0$. Aitoff defined this in 1889 as the equatorial-aspect azimuthal-equidistant projection of $(\varphi, \tfrac{\lambda}{2})$ with the resulting $x$-coordinate doubled — a construction motivated by his desire to reduce shape distortion in the Hammer projection while keeping the elliptical world boundary.

Two observations about the image of this map will matter below:

1. For $\varphi \in [-\tfrac{\pi}{2}, \tfrac{\pi}{2}]$ and $\lambda \in [-\pi, \pi]$, both $\cos\varphi$ and $\cos\tfrac{\lambda}{2}$ are nonnegative, so $\cos\varphi \cdot \cos\tfrac{\lambda}{2} \in [0, 1]$ and therefore $\alpha \in [0, \tfrac{\pi}{2}]$. In particular $\sin\alpha \geq 0$ and $\cos\alpha \geq 0$ throughout the domain.
2. The image of the projection is the ellipse $x^2 + 4y^2 \leq \pi^2$, achieved at the antipodal arc $\lambda = \pm\pi$, $\varphi = 0$ and the polar arc $\lambda = 0$, $\varphi = \pm\tfrac{\pi}{2}$.

## Why the closed form is not in the references

A brief survey of the standard implementations and references:

- **d3-geo** ([source](https://github.com/d3/d3-geo-projection/blob/main/src/aitoff.js)) inverts Aitoff with a 25-iteration Newton–Raphson loop, computing the $2 \times 2$ Jacobian by hand at each step.
- **PROJ** ([source](https://github.com/OSGeo/PROJ/blob/master/src/projections/aitoff.cpp)) uses nested Newton–Raphson — an inner loop of up to 10 iterations within an outer refinement loop of up to 20 rounds — and explicitly cites Bildirici and İpbüker's 2002 paper *A General Algorithm for the Inverse Transformation of Map Projections Using Jacobian Matrices*, which treats Aitoff as a worked example *for* their general iterative method.
- **Wikipedia's article on the Aitoff projection** gives the forward formula but does not discuss the inverse.
- A search of Google Scholar for *Aitoff inverse closed form* returns iterative-method papers; the one hit referencing closed-form Aitoff is Jackson & Bloxham (1991), where the projection actually used is Hammer–Aitoff (i.e. Hammer), which has a well-known closed-form inverse.

So the closed form is at least not in the references that practitioners currently reach for. Whether it is published somewhere in the older cartographic literature, I do not know; I derived it from scratch and have not exhaustively searched paper archives. The derivation is short enough that it would surprise me if no one had written it down before, but it is also short enough that there is little harm in writing it down again.

## Derivation of the closed-form inverse

Let $A = \alpha/\sin\alpha$ — the common factor that appears in both forward coordinates. Then

$$
\frac{x}{2} = A \cdot \cos\varphi \cdot \sin\tfrac{\lambda}{2}, \qquad y = A \cdot \sin\varphi.
$$

The key identity is the value of $(x/2)^2 + y^2$. Squaring and adding,

$$
\left(\tfrac{x}{2}\right)^2 + y^2 = A^2 \cdot \Bigl(\cos^2\varphi \cdot \sin^2\tfrac{\lambda}{2} + \sin^2\varphi\Bigr).
$$

We simplify the bracketed factor. Using $\sin^2\tfrac{\lambda}{2} = 1 - \cos^2\tfrac{\lambda}{2}$ and $\sin^2\varphi = 1 - \cos^2\varphi$,

$$
\cos^2\varphi \cdot \sin^2\tfrac{\lambda}{2} + \sin^2\varphi = \cos^2\varphi - \cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2} + \sin^2\varphi = 1 - \cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2}.
$$

But by Aitoff's definition $\cos\alpha = \cos\varphi \cdot \cos\tfrac{\lambda}{2}$, so $\cos^2\varphi \cdot \cos^2\tfrac{\lambda}{2} = \cos^2\alpha$, and the bracketed factor reduces to $1 - \cos^2\alpha = \sin^2\alpha$. Substituting back,

$$
\left(\tfrac{x}{2}\right)^2 + y^2 = A^2 \cdot \sin^2\alpha = \left(\frac{\alpha}{\sin\alpha}\right)^2 \cdot \sin^2\alpha = \alpha^2.
$$

Since $\alpha \geq 0$, taking the positive root gives the recovery of $\alpha$ from $(x, y)$:

$$
\boxed{\alpha = \sqrt{(x/2)^2 + y^2}.}
$$

This is the entire trick. Once $\alpha$ is known, the latitude follows by dividing $y$ by $A$:

$$
\sin\varphi = \frac{y}{A} = \frac{y \cdot \sin\alpha}{\alpha}, \qquad \varphi = \arcsin\!\left(\frac{y \cdot \sin\alpha}{\alpha}\right).
$$

For the longitude, observe that

$$
\frac{x/2}{y} = \frac{A \cdot \cos\varphi \cdot \sin\tfrac{\lambda}{2}}{A \cdot \sin\varphi} = \frac{\cos\varphi \cdot \sin\tfrac{\lambda}{2}}{\sin\varphi},
$$

which is the standard expression for $\tan$ of the bearing $\beta$ from the projection center $(0, 0)$ to the point $(\varphi, \tfrac{\lambda}{2})$ on the sphere. The azimuthal-equidistant projection places $(\varphi, \tfrac{\lambda}{2})$ at planar polar coordinates $(\alpha, \beta)$, so $(x/2, y) = (\alpha \sin\beta, \alpha\cos\beta)$. Therefore

$$
\sin\tfrac{\lambda}{2} = \frac{(x/2) \cdot \sin\alpha}{\alpha \cdot \cos\varphi}, \qquad \cos\tfrac{\lambda}{2} = \frac{\cos\alpha}{\cos\varphi},
$$

where the second equation follows directly from $\cos\alpha = \cos\varphi \cdot \cos\tfrac{\lambda}{2}$. The cleanest form for $\lambda$ uses these together via `atan2`, which selects the correct quadrant and avoids the $0/0$ degeneracy at the poles:

$$
\boxed{\lambda = 2 \cdot \mathrm{atan2}\bigl((x/2) \cdot \sin\alpha,\; \alpha \cdot \cos\alpha\bigr).}
$$

Three special cases close the derivation:

1. **At the origin** ($\alpha = 0$, i.e. $x = y = 0$): the formula $\varphi = \arcsin(y \sin\alpha / \alpha)$ contains $0/0$. Taking the limit $\alpha \to 0$ in the forward map gives $x \to \lambda$ and $y \to \varphi$, so $\varphi = y$ and $\lambda = x$ recovers the right answer.
2. **At the poles** ($\cos\varphi = 0$, equivalently $|y| = \alpha$): the expression for $\sin\tfrac{\lambda}{2}$ degenerates, but the `atan2` form remains well-defined because $\cos\alpha \cdot \alpha \to 0$ as well, and `atan2(0, 0)` is treated as $0$ — geometrically correct, since longitude is undefined at the poles.
3. **At the antipodes** ($\alpha = \tfrac{\pi}{2}$, i.e. on the ellipse boundary): $\cos\alpha = 0$ and the second argument of `atan2` vanishes, so `atan2` returns $\pm\tfrac{\pi}{2}$ according to the sign of $x$, giving $\lambda = \pm\pi$. This matches the forward map.

The full inverse algorithm is then:

```
α = sqrt((x/2)² + y²)
if α < ε:
    return (φ, λ) = (y, x)
sinα = sin(α)
φ = arcsin( clamp(y · sinα / α, -1, 1) )
λ = 2 · atan2( (x/2) · sinα, α · cos(α) )
return (φ, λ)
```

One square root, one `sin`, one `cos`, one `arcsin`, one `atan2`. No iteration; no Jacobian; no convergence test.

## Recovering the forward from the inverse

To show that the relationship is genuinely mutual — that the inverse formula encodes the same map as the forward, and is not merely a one-way reduction — we re-derive the forward from the inverse. Suppose $(\varphi, \lambda)$ are given and define $\alpha = \arccos(\cos\varphi \cos\tfrac{\lambda}{2})$ as before. The inverse formulas assert that

$$
\sin\varphi = \frac{y \sin\alpha}{\alpha} \quad\text{and}\quad \tan\tfrac{\lambda}{2} = \frac{(x/2) \sin\alpha}{\alpha \cos\alpha}.
$$

Solving the first for $y$:

$$
y = \frac{\alpha \sin\varphi}{\sin\alpha} = \sin\varphi \cdot \frac{\alpha}{\sin\alpha},
$$

which is the forward expression for $y$. For $x$, use $\cos\tfrac{\lambda}{2} = \cos\alpha / \cos\varphi$ (which follows from $\cos\alpha = \cos\varphi \cos\tfrac{\lambda}{2}$, valid wherever $\cos\varphi \neq 0$) to rewrite the second equation:

$$
\frac{\sin\tfrac{\lambda}{2}}{\cos\tfrac{\lambda}{2}} = \frac{(x/2) \sin\alpha}{\alpha \cos\alpha} \implies \sin\tfrac{\lambda}{2} \cdot \frac{\alpha \cos\alpha}{\cos\tfrac{\lambda}{2}} = \frac{x \sin\alpha}{2}.
$$

Substituting $\cos\tfrac{\lambda}{2} = \cos\alpha / \cos\varphi$ on the left,

$$
\sin\tfrac{\lambda}{2} \cdot \alpha \cdot \cos\alpha \cdot \frac{\cos\varphi}{\cos\alpha} = \frac{x \sin\alpha}{2} \implies x = \frac{2 \alpha \cos\varphi \sin\tfrac{\lambda}{2}}{\sin\alpha} = 2 \cos\varphi \sin\tfrac{\lambda}{2} \cdot \frac{\alpha}{\sin\alpha}.
$$

This is the forward expression for $x$. The two maps are mutual inverses on the interior, with the pole case handled by the $\arcsin$ degeneracy and the antipodal case handled by the `atan2` branch behavior described above. ∎

## Numerical comparison with d3-geo

I compared the closed-form against d3-geo's 25-iteration Newton–Raphson on a 101 × 51 grid of $(\varphi, \lambda)$ points covering the Aitoff ellipse with a 2 % stand-off from the boundary, both implemented in IEEE-754 double precision. For each grid point, I applied the forward map to get $(x, y)$ and then ran both inverse methods. The error of interest is the disagreement between the two inverses, measured as $(|\Delta\lambda \bmod 2\pi|, |\Delta\varphi|)$.

Of 5,151 grid points compared:

| Region | Count | Max $|\Delta\lambda|$ (rad) | Max $|\Delta\varphi|$ (rad) | Mean $|\Delta\lambda|$ | Mean $|\Delta\varphi|$ |
|---|---:|---:|---:|---:|---:|
| Interior agreement | 5,063 (98.3 %) | $2.1 \times 10^{-12}$ | $1.4 \times 10^{-13}$ | $1.6 \times 10^{-14}$ | $1.9 \times 10^{-15}$ |
| Near-boundary disagreement | 88 (1.7 %) | drifts to other $2\pi$ branches | (see below) | — | — |

In the interior 98.3 % of points, the closed-form and Newton–Raphson agree to within machine epsilon — about a factor of 2–10 over the smallest representable difference at that magnitude. This is the expected outcome: both methods are computing the same well-conditioned function on a region where it is smooth.

For the 88 disagreeing points, all of which lie close to the antipodal arc (where $|\lambda|$ approaches $\pi$ at small $|\varphi|$), the disagreement is not a precision issue but a *branch* issue. d3-geo's Newton iteration starts at $(x_1, y_1) = (x, y)$ — i.e. it uses the planar coordinates themselves as an initial latitude/longitude guess — and in regions where the Aitoff Jacobian is ill-conditioned, the Newton step can carry the iterate into an adjacent $2\pi$-period of longitude. I verified that both inverses are nevertheless *mathematically* correct by forward-projecting their outputs and confirming both round-trip to the input $(x, y)$ within $10^{-15}$. The d3-geo result is a valid solution; it just happens to be the wrong representative.

The closed-form constrains its longitude output to $[-\pi, \pi]$ by construction (the range of `atan2`), so the branch ambiguity does not arise. This is a small robustness win on top of the speed and simplicity gains.

## Takeaways

1. **The closed form is real and matches the established iterative method on the interior.** Across the entire Aitoff ellipse minus a thin border strip, the closed-form output and d3-geo's Newton–Raphson output agree to within machine precision. There is no numerical regime where the iterative method is more accurate than the closed form.

2. **The closed form is more robust at the boundary.** Where Newton–Raphson can drift to an out-of-range longitude branch, the closed-form's `atan2` keeps the answer in $[-\pi, \pi]$ unconditionally. If a downstream caller does not wrap longitudes back into the canonical range, the iterative result can be substantively wrong at the antipodes.

3. **The closed form is cheaper.** One square root, one `sin`, one `cos`, one `arcsin`, one `atan2` — five transcendental evaluations total — versus, in d3-geo's case, eight trig calls plus a $2 \times 2$ Jacobian solve per iteration, repeated until convergence (up to 25 times). PROJ's nested loop is more expensive still.

4. **The derivation is short and the result follows directly from the projection's definition.** The fact that Aitoff is built from the azimuthal-equidistant projection of $(\varphi, \lambda/2)$ is mentioned in every reference. The fact that the azimuthal-equidistant has a closed-form inverse is mentioned in every reference. Connecting the two is one algebraic identity. The absence of this from the standard implementations is a curious gap in the literature rather than evidence that the result is hard.

## Implications and library status

The major open-source projection libraries that ship Aitoff today are:

- **PROJ** (C++, the lingua franca of geospatial software): uses nested Newton–Raphson, citing Bildirici–İpbüker. Replacing the inverse with the closed form is a straightforward patch; the only piece of state to manage is the existing bounds check on $x^2 + 4y^2 \leq \pi^2$, which the closed form needs to retain. Performance impact would be most noticeable in workloads that invert large vector datasets through Aitoff — for example, reprojecting a dense raster from Aitoff to another CRS.

- **d3-geo-projection** (JavaScript): same situation. The hand-derived Jacobian and the 25-iteration loop together comprise about 30 lines; the closed form is six. A drop-in replacement would also let `d3.geoAitoff().invert(...)` produce canonical longitudes at the antipodes without an extra wrapping step.

- **GeographicLib** (Charles Karney, C++ / Python / Java): does not ship Aitoff in its core projection set, so there is nothing to patch here. Karney's library generally favors closed-form or series-based solutions where they exist, so the addition would fit the library's style well.

- **pyproj** (Python bindings to PROJ): inherits PROJ's inverse, so any PROJ patch flows through automatically.

- **Cartopy / Mapproxy / GDAL**: all delegate Aitoff to PROJ.

## Winkel Tripel: partial benefit, not a closed form

The natural next question is whether the closed-form Aitoff inverse propagates to **Winkel Tripel** — Oswald Winkel's 1921 compromise projection, defined as the arithmetic mean of Aitoff and equirectangular. It served as *National Geographic*'s flagship world projection from 1998 through 2015, and the Bildirici–İpbüker paper that PROJ cites uses it as its other principal worked example. In every implementation I have looked at — PROJ, d3-geo-projection, Esri ArcGIS — Winkel Tripel's inverse is iterative.

The Winkel Tripel forward map is

$$
x_{WT} = \tfrac{1}{2}\bigl(x_A + \tfrac{2\lambda}{\pi}\bigr), \qquad y_{WT} = \tfrac{1}{2}(y_A + \varphi),
$$

where $(x_A, y_A)$ are the Aitoff forward coordinates and the equirectangular contribution uses the standard parallel $\varphi_1 = \arccos(2/\pi)$. Solving for the Aitoff terms gives $x_A = 2x_{WT} - 2\lambda/\pi$ and $y_A = 2y_{WT} - \varphi$. Substituting into the closed-form Aitoff identity $\alpha^2 = (x_A/2)^2 + y_A^2$ would, if it worked, give us $\alpha$ in one step. It does not work, because the substitution introduces $\varphi$ and $\lambda$ on the right-hand side:

$$
\alpha = \sqrt{\bigl(x_{WT} - \lambda/\pi\bigr)^2 + (2y_{WT} - \varphi)^2}.
$$

The equirectangular contribution couples $\varphi$ and $\lambda$ back into the expression that recovered $\alpha$ algebraically for Aitoff, and the resulting two-by-two system is transcendental in $(\varphi, \lambda)$ with no algebraic separation. **No closed-form Winkel Tripel inverse exists** — or at least none derivable from this approach, which is the structurally natural one once Aitoff is in closed form.

One might still hope to use the closed-form Aitoff inverse as the inner step of a *non*-closed-form iteration — a fixed-point iteration of the natural map

$$
T(\varphi, \lambda) = A^{-1}\bigl(2x_{WT} - 2\lambda/\pi,\; 2y_{WT} - \varphi\bigr),
$$

whose fixed points are exactly the Winkel Tripel inverses. This does not work either, and the failure modes are instructive.

Linearizing $T$ at the origin gives a diagonal Jacobian $\mathrm{diag}(-1, -2/\pi)$. The $\lambda$ eigenvalue, $-2/\pi$, contracts at rate $\approx 0.637$ per iteration. The $\varphi$ eigenvalue, $-1$, is exactly neutral: undamped iteration in $\varphi$ produces a stable two-cycle that flips sign each step without changing amplitude. Traced numerically at $(\varphi, \lambda) = (10°, 20°)$, the $\lambda$ error decays geometrically as predicted while the $\varphi$ error settles into a sign-flipping oscillation around amplitude $3.5 \times 10^{-4}$ and stays there indefinitely. The iteration is **not converging** — it has reached the attracting two-cycle of the eigenvalue-$-1$ mode. To loose tolerance this can be mistaken for slow convergence; to tight tolerance it never terminates.

Under-relaxation with $\omega < 1$ removes the eigenvalue-$-1$ stagnation in the linear regime: the damped iteration map at the origin becomes $\mathrm{diag}(1 - 2\omega,\; 1 - \omega(1 + 2/\pi))$, contracting for any $\omega \in (0, 1)$ and choosing $\omega = 1/2$ gives the optimal corner-case worst-rate of $|1/2 - 1/\pi| \approx 0.182$. On the interior of the Winkel Tripel domain — points away from the boundary — damped iteration does converge, in around 20 to 30 steps per point on a generous error tolerance.

The interior is not the whole story. The Winkel Tripel image is slightly *larger* than the Aitoff ellipse along the equator (the equirectangular contribution adds $\lambda/\pi$ to $x_A/2$, so $|x_{WT}|$ can exceed $|x_A/2|$). Near that outer band — the polar and antimeridian corners, where $|\lambda|$ approaches $\pi$ at large $|\varphi|$ — the very first iteration of $T$ pushes the virtual Aitoff input $(2x_{WT} - 2\lambda/\pi,\; 2y_{WT} - \varphi)$ *outside* the Aitoff ellipse $x_A^2 + 4y_A^2 \leq \pi^2$. The closed-form Aitoff inverse correctly refuses out-of-domain inputs; the iteration has nowhere to go and fails immediately. Damping the step does not help because the iterate's *starting* position is what falls out of domain, not its trajectory. Tested explicitly at $(-65°, -177°)$ and $(85°, 175°)$, damped iteration fails after 1–2 steps regardless of $\omega$. The corresponding fraction of failing grid points in my earlier sweep — which I had excluded from the convergence summary — is about 8.5 %, exactly the boundary band.

The robust Winkel Tripel solver is therefore **two-dimensional Newton–Raphson on the analytical Jacobian**, exactly as PROJ and d3-geo already implement it. With a careful longitude-wrapping guard (so the Newton step cannot flip the iterate across the ±180° seam), this converges to machine precision in around six iterations across the entire WT image, including the antipodal corners.

The closed-form Aitoff inverse therefore contributes to Winkel Tripel as a structural improvement rather than an algorithmic one. PROJ's `aitoff.cpp` implements both Aitoff and Winkel Tripel through a single function distinguished by a `Mode` enum, with the Winkel Tripel branch adding the equirectangular contribution inside the same Newton–Raphson loop. Replacing the Aitoff inverse path with the closed form simplifies the Aitoff branch dramatically and leaves the Winkel Tripel branch's Newton–Raphson structure intact. The Winkel Tripel solver remains iterative; it is just *implemented* against a cleaner Aitoff foundation.

## Wagner IX: closed form by composition

A second derivative of Aitoff — far less famous, but cleaner in its outcome — is **Wagner IX**, also called Aitoff-Wagner, introduced by Karlheinz Wagner in 1949. Wagner's modification addresses the principal aesthetic objection to Aitoff (and Hammer): that the poles collapse to single points, which distorts polar features at the global scale. Wagner's fix is to introduce a *pole line* — to make the poles appear as horizontal line segments rather than points — by applying Aitoff not to the original $(\varphi, \lambda)$ but to scaled versions of them.

The construction is, schematically:

$$
\varphi' = \arcsin\bigl(m \sin\varphi\bigr), \qquad \lambda' = n\lambda, \qquad (x, y) = \bigl(s_x,\, s_y\bigr) \cdot \mathrm{Aitoff}(\varphi', \lambda'),
$$

for fixed Wagner constants $m, n, s_x, s_y$ chosen to give the desired pole-line proportions. The pre- and post-scaling are all closed-form, and so the inverse is closed-form by composition:

$$
\bigl(\varphi', \lambda'\bigr) = \mathrm{Aitoff}^{-1}\bigl(x/s_x,\; y/s_y\bigr), \qquad \varphi = \arcsin\bigl(\sin\varphi' / m\bigr), \qquad \lambda = \lambda'/n.
$$

That is the entire inverse. One application of the closed-form Aitoff inverse, two scalar divisions, one $\arcsin$. It is closed-form for the same reason and to the same precision as Aitoff itself.

The library status here is different from Winkel Tripel's. Neither PROJ nor d3-geo-projection ships Wagner IX at all — not the forward, not the inverse. Wagner IX has historically been treated as a curiosity rather than a standard projection, partly because the iterative inverse is awkward to write and partly because its standard implementations require either iteration or the closed-form Aitoff inverse, and the latter was not in circulation. With the closed-form in hand, Wagner IX becomes about as expensive to implement as a scaled Aitoff. Whether it deserves to be more widely shipped is a question for the cartography community; the technical obstacle is gone.

---

Patches to PROJ and d3-geo are small and well-defined. The Aitoff replacement is a self-contained change in two C++ functions and one JavaScript file. The Winkel Tripel branch in PROJ inherits the same change automatically. Wagner IX would be a fresh addition rather than a patch, and is short enough that it could be bundled in the same pull request.

Flatsphere now ships with the closed-form inverse for Aitoff. Round-trip error on the GPU is bounded by the worse of `f32` precision in the WGSL shader and the input coordinate precision; in our testing it sits below the precision of the screen pixel grid at every zoom level we have tried.
