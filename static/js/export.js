/**
 * Export Component
 * Client-side Vector PDF Dossier (jsPDF), pixel-perfect PNG card generation (Native Canvas 2D), and README badge snippet.
 */

import {
	showToast,
	compact,
	full,
	avatarUrl,
	getLangColor,
	esc,
} from "./utils.js";

// Helper: Convert ANY CSS color (#hex or rgb) to [R, G, B] array for jsPDF
function hexToRgb(color, fallback = [139, 108, 255]) {
	if (!color || typeof color !== "string") return fallback;
	const c = color.trim();
	if (c.startsWith("#")) {
		let hex = c.slice(1);
		if (hex.length === 3)
			hex = hex
				.split("")
				.map((x) => x + x)
				.join("");
		const num = parseInt(hex.slice(0, 6), 16);
		if (!Number.isNaN(num)) {
			return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
		}
	}
	const rgbMatch = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
	if (rgbMatch) {
		return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
	}
	return fallback;
}

// Helper: Blend RGB color with dark background to simulate alpha transparency in jsPDF
function blendRgb(rgb, alpha, bg = [18, 18, 26]) {
	return [
		Math.round(rgb[0] * alpha + bg[0] * (1 - alpha)),
		Math.round(rgb[1] * alpha + bg[1] * (1 - alpha)),
		Math.round(rgb[2] * alpha + bg[2] * (1 - alpha)),
	];
}

// Helper: Sanitize strings for jsPDF standard WinAnsiEncoding fonts (removes NBSP & unsupported glyphs)
function cleanText(str) {
	if (str === null || str === undefined) return "";
	return String(str)
		.replace(/\u00A0/g, " ")
		.replace(/…/g, "...")
		.replace(/[—–]/g, "-")
		.replace(/[^\x20-\x7E\xA1-\xFF]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

// Helper: Truncate text to fit a maximum millimeter width in jsPDF without clipping
function fitText(doc, str, maxWidthMm) {
	const s = cleanText(str);
	if (!s) return "";
	if (doc.getTextWidth(s) <= maxWidthMm) return s;
	const ellipsis = "...";
	const ellW = doc.getTextWidth(ellipsis);
	let lo = 0;
	let hi = s.length;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (doc.getTextWidth(s.slice(0, mid)) + ellW <= maxWidthMm) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}
	return s.slice(0, Math.max(1, lo)).trimEnd() + ellipsis;
}

// Helper: Draw crisp vector icons natively in jsPDF (replaces broken Unicode ★, ⑂, ⊙, ✓)
function drawPdfIcon(doc, type, cx, cy, r = 1.4, rgb = [255, 255, 255]) {
	doc.setDrawColor(...rgb);
	doc.setFillColor(...rgb);
	doc.setLineWidth(0.28);

	if (type === "star") {
		// 5-point star polygon
		const pts = [];
		for (let i = 0; i < 10; i++) {
			const rad = i % 2 === 0 ? r : r * 0.44;
			const angle = -Math.PI / 2 + (i * Math.PI) / 5;
			pts.push([cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)]);
		}
		const deltas = [];
		for (let i = 1; i < pts.length; i++) {
			deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
		}
		doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], "F", true);
	} else if (type === "fork") {
		// Git fork icon (3 nodes + Y branch)
		const nr = r * 0.28;
		doc.circle(cx - r * 0.55, cy - r * 0.65, nr, "S");
		doc.circle(cx + r * 0.55, cy - r * 0.65, nr, "S");
		doc.circle(cx, cy + r * 0.7, nr, "S");
		doc.line(cx - r * 0.55, cy - r * 0.35, cx - r * 0.55, cy - r * 0.05);
		doc.line(cx + r * 0.55, cy - r * 0.35, cx + r * 0.55, cy - r * 0.05);
		doc.line(cx - r * 0.55, cy - r * 0.05, cx, cy + r * 0.15);
		doc.line(cx + r * 0.55, cy - r * 0.05, cx, cy + r * 0.15);
		doc.line(cx, cy + r * 0.15, cx, cy + r * 0.42);
	} else if (type === "issue") {
		// Issue circle with center dot
		doc.circle(cx, cy, r * 0.85, "S");
		doc.circle(cx, cy, r * 0.28, "F");
	} else if (type === "check") {
		// Checkmark inside circle
		doc.circle(cx, cy, r * 0.95, "F");
		doc.setDrawColor(12, 16, 14);
		doc.setLineWidth(0.35);
		doc.line(cx - r * 0.45, cy + r * 0.02, cx - r * 0.1, cy + r * 0.38);
		doc.line(cx - r * 0.1, cy + r * 0.38, cx + r * 0.48, cy - r * 0.35);
	} else if (type === "cross") {
		// Muted circle with dash
		doc.circle(cx, cy, r * 0.95, "S");
		doc.line(cx - r * 0.35, cy, cx + r * 0.35, cy);
	} else if (type === "badge") {
		// Diamond/medal icon for unlocked badges
		const d = r * 0.9;
		doc.lines(
			[
				[d, d],
				[-d, d],
				[-d, -d],
			],
			cx,
			cy - d,
			[1, 1],
			"F",
			true,
		);
	} else if (type === "lock") {
		// Small padlock for locked badges
		doc.roundedRect(cx - r * 0.65, cy - r * 0.1, r * 1.3, r * 1.0, 0.3, 0.3, "S");
		doc.circle(cx, cy - r * 0.25, r * 0.4, "S");
	}
}

// Helper: Generate a crisp circular/squircle PNG dataURL for avatar + ring charts in PDF
function createCircularAvatarDataUrl(img, nameFallback = "D") {
	const size = 240;
	const c = document.createElement("canvas");
	c.width = size;
	c.height = size;
	const ctx = c.getContext("2d");

	// Squircle clip
	const r = 52;
	ctx.beginPath();
	ctx.moveTo(r, 0);
	ctx.arcTo(size, 0, size, size, r);
	ctx.arcTo(size, size, 0, size, r);
	ctx.arcTo(0, size, 0, 0, r);
	ctx.arcTo(0, 0, size, 0, r);
	ctx.closePath();
	ctx.save();
	ctx.clip();

	if (img) {
		ctx.drawImage(img, 0, 0, size, size);
	} else {
		ctx.fillStyle = "#1e1b4b";
		ctx.fillRect(0, 0, size, size);
		ctx.fillStyle = "#c4b5fd";
		ctx.font = "bold 110px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(
			String(nameFallback).charAt(0).toUpperCase(),
			size / 2,
			size / 2,
		);
	}
	ctx.restore();

	// Border
	ctx.strokeStyle = "#8b6cff";
	ctx.lineWidth = 8;
	ctx.stroke();

	return c.toDataURL("image/png");
}

// Helper: Render a crisp high-DPI ring gauge or multi-segment donut chart to PNG for jsPDF
function createRingChartDataUrl({
	segments = [],
	centerTop = "",
	centerTopColor = "#ffffff",
	centerSub = "",
	size = 220,
	thickness = 22,
}) {
	const c = document.createElement("canvas");
	c.width = size;
	c.height = size;
	const ctx = c.getContext("2d");
	const cx = size / 2;
	const cy = size / 2;
	const radius = (size - thickness * 2) / 2;

	// Track ring
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.strokeStyle = "#232332";
	ctx.lineWidth = thickness;
	ctx.stroke();

	// Draw segments
	let startAngle = -Math.PI / 2;
	segments.forEach((seg) => {
		const frac = Math.max(0, Math.min(1, Number(seg.fraction) || 0));
		if (frac <= 0) return;
		const sweep = frac * Math.PI * 2;
		ctx.beginPath();
		ctx.arc(cx, cy, radius, startAngle, startAngle + sweep);
		ctx.strokeStyle = seg.color || "#8b6cff";
		ctx.lineWidth = thickness;
		ctx.lineCap = segments.length === 1 ? "round" : "butt";
		ctx.stroke();
		startAngle += sweep;
	});

	if (centerTop) {
		ctx.fillStyle = centerTopColor;
		ctx.font = `800 ${Math.round(size * 0.2)}px 'JetBrains Mono', monospace, sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(String(centerTop), cx, centerSub ? cy - size * 0.05 : cy);
	}
	if (centerSub) {
		ctx.fillStyle = "#9ca3af";
		ctx.font = `600 ${Math.round(size * 0.085)}px 'Inter', sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(String(centerSub), cx, cy + size * 0.12);
	}

	return c.toDataURL("image/png");
}

export async function exportPdf(dossier) {
	if (!dossier || !dossier.profile) {
		showToast("No profile scanned yet", "alert-triangle");
		return;
	}

	showToast("Generating full PDF dossier...", "file-text");
	const btn = document.getElementById("dockBtnPdf");
	if (btn) btn.classList.add("opacity-50", "pointer-events-none");

	try {
		const { jsPDF } = window.jspdf;
		const doc = new jsPDF({
			orientation: "portrait",
			unit: "mm",
			format: "a4",
		});
		const PW = 210;
		const PH = 297;
		const M = 12;
		const CW = PW - M * 2; // 186mm content width

		const profile = dossier.profile || {};
		const score = dossier.score || {};
		const breakdown = score.breakdown || {};
		const arch = dossier.archetype || {};
		const stats = dossier.stats || {};
		const streaks = dossier.streaks || {};
		const level = dossier.level || {};
		const badges = Array.isArray(dossier.badges) ? dossier.badges : [];
		const langsObj = dossier.languages || {};
		const repos = Array.isArray(dossier.repos)
			? dossier.repos
			: Array.isArray(dossier.top_repos)
				? dossier.top_repos
				: [];
		const commits = dossier.commits || dossier.commit_quality || {};
		const readme = dossier.readme || dossier.readme_quality || {};
		const prStats =
			dossier.pull_requests || dossier.prs || dossier.community || {};
		const gists = dossier.gists || {};
		const social = dossier.social || {};

		const login = cleanText(profile.login || "developer");
		const name = cleanText(profile.name || login);
		const totalScore = Math.max(
			0,
			Math.min(1000, Number(score.total) || 0),
		);
		const grade = cleanText(score.grade || "E");
		const archLabel = cleanText(arch.label || "Code Craftsman").toUpperCase();
		const archRgb = hexToRgb(arch.glow || "#06b6d4", [6, 182, 212]);

		// Pre-fetch avatar
		const avatarImg = await fetchAvatarImage(login, profile.avatar_url);
		const avatarDataUrl = createCircularAvatarDataUrl(avatarImg, name);

		// Helper: Paint dark page background + subtle header/footer chrome
		const drawPageChrome = (pageNum, totalPages) => {
			doc.setFillColor(9, 9, 13);
			doc.rect(0, 0, PW, PH, "F");

			// Top bar
			doc.setFillColor(18, 18, 26);
			doc.rect(0, 0, PW, 10, "F");
			doc.setDrawColor(40, 40, 55);
			doc.setLineWidth(0.25);
			doc.line(0, 10, PW, 10);

			doc.setFont("courier", "bold");
			doc.setFontSize(7.5);
			doc.setTextColor(198, 244, 50);
			doc.text("GIT-SPECTRE", M, 6.4);
			doc.setTextColor(130, 130, 148);
			doc.setFont("courier", "normal");
			doc.text(
				`// DEVELOPER DEEP-PROFILER DOSSIER  |  @${login}`,
				M + 21,
				6.4,
			);

			doc.setTextColor(130, 130, 148);
			doc.text(`PAGE ${pageNum} OF ${totalPages}`, PW - M, 6.4, {
				align: "right",
			});

			// Footer
			doc.setDrawColor(32, 32, 44);
			doc.line(M, PH - 10, PW - M, PH - 10);
			doc.setFont("courier", "normal");
			doc.setFontSize(7);
			doc.setTextColor(110, 110, 126);
			doc.text(
				`Generated by Git-Spectre  |  https://git-spectre.vercel.app/?u=${login}`,
				M,
				PH - 5.5,
			);
			doc.text(new Date().toISOString().slice(0, 10), PW - M, PH - 5.5, {
				align: "right",
			});
		};

		// Helper: Draw a styled dark card panel
		const drawCard = (
			x,
			y,
			w,
			h,
			fill = [16, 16, 23],
			stroke = [38, 38, 52],
			r = 3.5,
		) => {
			doc.setFillColor(...fill);
			doc.setDrawColor(...stroke);
			doc.setLineWidth(0.3);
			doc.roundedRect(x, y, w, h, r, r, "FD");
		};

		// Helper: Section divider header
		const drawSectionHeader = (title, y) => {
			const cleanTitle = cleanText(title).toUpperCase();
			doc.setFont("courier", "bold");
			doc.setFontSize(7.5);
			doc.setTextColor(150, 150, 168);
			doc.text(cleanTitle, M, y);
			const tw = doc.getTextWidth(cleanTitle);
			doc.setDrawColor(38, 38, 52);
			doc.setLineWidth(0.25);
			doc.line(M + tw + 4, y - 1, PW - M, y - 1);
		};

		// =========================================================================
		// PAGE 1: IDENTITY, SCORE, CORE METRICS, PROGRESSION, HEATMAP & STACK DNA
		// =========================================================================
		drawPageChrome(1, 2);
		let curY = 14;

		// --- 1. HERO ROW: Identity Card (Left, 116mm) + Developer Score Card (Right, 66mm) ---
		const heroH = 52;
		const idCardW = 116;
		const scoreCardW = CW - idCardW - 4; // 66mm
		drawCard(M, curY, idCardW, heroH, [16, 16, 24], [46, 42, 72]);
		drawCard(
			M + idCardW + 4,
			curY,
			scoreCardW,
			heroH,
			[16, 16, 24],
			[46, 42, 72],
		);

		// Avatar inside Identity Card
		doc.addImage(avatarDataUrl, "PNG", M + 5, curY + 5, 22, 22);

		// Name & @login (fitted to avoid clipping right border)
		doc.setFont("helvetica", "bold");
		doc.setFontSize(13.5);
		doc.setTextColor(255, 255, 255);
		doc.text(fitText(doc, name, idCardW - 36), M + 31, curY + 10.5);

		doc.setFont("courier", "bold");
		doc.setFontSize(8.5);
		doc.setTextColor(167, 139, 250);
		doc.text(fitText(doc, `@${login}`, idCardW - 36), M + 31, curY + 15.8);

		// Archetype Pill
		doc.setFont("courier", "bold");
		doc.setFontSize(6.8);
		const fittedArch = fitText(doc, archLabel, idCardW - 45);
		const pillTextW = doc.getTextWidth(fittedArch);
		const pillW = pillTextW + 9;
		const pillX = M + 31;
		const pillY = curY + 18.8;
		doc.setFillColor(...blendRgb(archRgb, 0.16, [16, 16, 24]));
		doc.setDrawColor(...archRgb);
		doc.setLineWidth(0.3);
		doc.roundedRect(pillX, pillY, pillW, 5.2, 2.6, 2.6, "FD");
		doc.setFillColor(...archRgb);
		doc.circle(pillX + 3, pillY + 2.6, 0.9, "F");
		doc.setTextColor(...archRgb);
		doc.text(fittedArch, pillX + 5.2, pillY + 3.5);

		// Bio text
		doc.setFont("helvetica", "normal");
		doc.setFontSize(7.5);
		doc.setTextColor(175, 175, 190);
		const bioRaw = cleanText(profile.bio || "No public bio provided.");
		const bioLines = doc.splitTextToSize(bioRaw, idCardW - 10).slice(0, 2);
		doc.text(bioLines, M + 5, curY + 32);

		// Location / Company / Joined metadata line
		const metaParts = [];
		if (profile.location) metaParts.push(cleanText(profile.location));
		if (profile.company) metaParts.push(cleanText(profile.company));
		if (profile.created_at)
			metaParts.push(`Joined ${String(profile.created_at).slice(0, 4)}`);
		if (profile.blog)
			metaParts.push(
				cleanText(profile.blog).replace(/^https?:\/\//, ""),
			);
		doc.setFont("courier", "normal");
		doc.setFontSize(6.5);
		doc.setTextColor(125, 125, 142);
		const metaStr = metaParts.join("  |  ") || `github.com/${login}`;
		doc.text(fitText(doc, metaStr, idCardW - 10), M + 5, curY + 41.8);

		// Terminal status quote box
		doc.setFillColor(12, 12, 18);
		doc.setDrawColor(32, 32, 46);
		doc.roundedRect(M + 5, curY + 44, idCardW - 10, 5.5, 1.5, 1.5, "FD");
		doc.setFont("courier", "normal");
		doc.setFontSize(6.3);
		doc.setTextColor(160, 160, 178);
		const statusText = cleanText(
			arch.description ||
				`Active streak: ${streaks.current ?? 0}d | Best streak: ${streaks.longest ?? 0}d`,
		);
		doc.text(
			fitText(doc, `> ${statusText}`, idCardW - 14),
			M + 7,
			curY + 47.7,
		);

		// --- Developer Score Card (Right) ---
		const sx = M + idCardW + 4;
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8.5);
		doc.setTextColor(240, 240, 245);
		doc.text("Developer Score", sx + 4.5, curY + 6.5);

		// Grade pill top-right
		doc.setFillColor(198, 244, 50);
		doc.roundedRect(
			sx + scoreCardW - 15,
			curY + 3.2,
			10.5,
			5,
			1.5,
			1.5,
			"F",
		);
		doc.setFont("courier", "bold");
		doc.setFontSize(7.5);
		doc.setTextColor(12, 15, 6);
		doc.text(`${grade}`, sx + scoreCardW - 9.75, curY + 6.7, {
			align: "center",
		});

		// Score Ring Gauge Image (Left side of score card)
		const scoreRingUrl = createRingChartDataUrl({
			segments: [{ fraction: totalScore / 1000, color: "#8b6cff" }],
			centerTop: String(totalScore),
			centerSub: "/ 1000",
			size: 200,
			thickness: 22,
		});
		doc.addImage(scoreRingUrl, "PNG", sx + 3.5, curY + 11, 24, 24);

		// Score Breakdown Bars (Right side of score card)
		const bdItems = [
			{
				label: "Code Impact",
				val:
					breakdown.impact ??
					breakdown.code_impact ??
					Math.round(totalScore * 0.22),
				max: 300,
				color: [139, 108, 255],
			},
			{
				label: "Consistency",
				val: breakdown.consistency ?? Math.round(totalScore * 0.18),
				max: 200,
				color: [56, 189, 248],
			},
			{
				label: "Polyglot DNA",
				val:
					breakdown.polyglot ??
					breakdown.diversity ??
					Math.round(totalScore * 0.25),
				max: 200,
				color: [52, 211, 153],
			},
			{
				label: "Documentation",
				val:
					breakdown.documentation ??
					breakdown.quality ??
					Math.round(totalScore * 0.2),
				max: 150,
				color: [250, 204, 21],
			},
			{
				label: "Community",
				val:
					breakdown.community ??
					breakdown.maturity ??
					Math.round(totalScore * 0.15),
				max: 150,
				color: [244, 63, 94],
			},
		];
		let bdy = curY + 13.5;
		const bdx = sx + 29.5;
		const bdw = scoreCardW - 33.5;
		bdItems.forEach((item) => {
			doc.setFont("helvetica", "normal");
			doc.setFontSize(5.5);
			doc.setTextColor(160, 160, 176);
			doc.text(item.label, bdx, bdy);
			doc.setFont("courier", "bold");
			doc.setFontSize(5.5);
			doc.setTextColor(225, 225, 235);
			doc.text(`${item.val}/${item.max}`, bdx + bdw, bdy, {
				align: "right",
			});

			// Bar background
			doc.setFillColor(30, 30, 44);
			doc.roundedRect(bdx, bdy + 1, bdw, 1.4, 0.7, 0.7, "F");
			// Bar fill
			const fillW = Math.max(
				1,
				Math.min(bdw, (Number(item.val) / item.max) * bdw),
			);
			doc.setFillColor(...item.color);
			doc.roundedRect(bdx, bdy + 1, fillW, 1.4, 0.7, 0.7, "F");
			bdy += 6.8;
		});

		curY += heroH + 4;

		// --- 2. FOUR CORE METRIC TILES ---
		const tileGap = 3.5;
		const tileW = (CW - tileGap * 3) / 4;
		const tileH = 16;
		const coreMetrics = [
			{
				label: "Own Repositories",
				val: full(stats.own_repos ?? stats.total_repos ?? 0),
				sub: `${full(stats.forked_repos ?? 0)} forked`,
				accent: [74, 222, 128],
				icon: "issue",
			},
			{
				label: "Total Stars Earned",
				val: full(stats.total_stars ?? 0),
				sub: "Across public repos",
				accent: [250, 204, 21],
				icon: "star",
			},
			{
				label: "Followers",
				val: full(profile.followers ?? 0),
				sub: `Following ${full(profile.following ?? 0)}`,
				accent: [167, 139, 250],
				icon: "badge",
			},
			{
				label: "Longest Streak",
				val: `${streaks.longest ?? streaks.current ?? 0} days`,
				sub: `Current: ${streaks.current ?? 0} days`,
				accent: [198, 244, 50],
				icon: "badge",
			},
		];

		coreMetrics.forEach((m, i) => {
			const tx = M + i * (tileW + tileGap);
			drawCard(tx, curY, tileW, tileH);
			drawPdfIcon(doc, m.icon, tx + 4.2, curY + 4.3, 1.2, m.accent);
			doc.setFont("helvetica", "normal");
			doc.setFontSize(6.6);
			doc.setTextColor(156, 163, 175);
			doc.text(m.label, tx + 6.8, curY + 5.1);

			doc.setFont("courier", "bold");
			doc.setFontSize(11.5);
			doc.setTextColor(255, 255, 255);
			doc.text(fitText(doc, String(m.val), tileW - 8), tx + 4, curY + 11.3);

			doc.setFont("courier", "normal");
			doc.setFontSize(5.8);
			doc.setTextColor(115, 115, 132);
			doc.text(fitText(doc, m.sub, tileW - 8), tx + 4, curY + 14.5);
		});

		curY += tileH + 6;

		// --- 3. PROGRESSION: LEVEL & ACHIEVEMENTS ---
		drawSectionHeader("Progression | Level & Achievements", curY);
		curY += 3;
		const progH = 28;
		drawCard(M, curY, CW, progH);

		const lvlNum = level.level ?? level.current ?? 2;
		const lvlTitle = cleanText(
			level.title ||
				level.rank ||
				(totalScore >= 700
					? "Staff"
					: totalScore >= 450
						? "Senior"
						: "Junior"),
		);
		const lvlPct = Math.max(
			5,
			Math.min(
				100,
				Number(
					level.progress_pct ??
						level.percent ??
						Math.round((totalScore % 300) / 3),
				) || 75,
			),
		);

		const lvlRingUrl = createRingChartDataUrl({
			segments: [{ fraction: lvlPct / 100, color: "#38bdf8" }],
			centerTop: `${lvlPct}%`,
			centerSub: `LVL ${lvlNum}`,
			size: 160,
			thickness: 18,
		});
		doc.addImage(lvlRingUrl, "PNG", M + 4, curY + 3.5, 21, 21);

		doc.setFont("courier", "normal");
		doc.setFontSize(6.5);
		doc.setTextColor(140, 140, 158);
		doc.text("CURRENT RANK", M + 28, curY + 8.5);

		doc.setFont("helvetica", "bold");
		doc.setFontSize(12.5);
		doc.setTextColor(56, 189, 248);
		doc.text(fitText(doc, lvlTitle, 40), M + 28, curY + 14.5);

		// XP Bar
		doc.setFillColor(28, 28, 42);
		doc.roundedRect(M + 28, curY + 18, 38, 2, 1, 1, "F");
		doc.setFillColor(56, 189, 248);
		doc.roundedRect(M + 28, curY + 18, (38 * lvlPct) / 100, 2, 1, 1, "F");
		doc.setFont("courier", "normal");
		doc.setFontSize(6);
		doc.setTextColor(130, 130, 148);
		doc.text(`Score XP: ${totalScore} / 1000`, M + 28, curY + 23);

		// Achievement Badges Grid (Right side of Progression Card)
		const displayBadges = badges.length
			? badges.slice(0, 6)
			: [
					{
						name: "Polyglot",
						tier: "GOLD",
						unlocked: Object.keys(langsObj).length >= 4,
					},
					{
						name: "Star Magnet",
						tier: "SILVER",
						unlocked: (stats.total_stars ?? 0) >= 50,
					},
					{
						name: "Repo Builder",
						tier: "SILVER",
						unlocked: (stats.own_repos ?? 0) >= 20,
					},
					{ name: "Night Owl", tier: "BRONZE", unlocked: true },
					{
						name: "Streak Runner",
						tier: "BRONZE",
						unlocked: (streaks.longest ?? 0) >= 3,
					},
					{
						name: "Open Source",
						tier: "GOLD",
						unlocked: (profile.followers ?? 0) >= 5,
					},
				];

		const bxStart = M + 72;
		const bw = (CW - 76 - 6) / 3;
		const bh = 10;
		displayBadges.forEach((b, idx) => {
			const col = idx % 3;
			const row = Math.floor(idx / 3);
			const bx = bxStart + col * (bw + 3);
			const by = curY + 3.5 + row * (bh + 2);
			const unlocked = b.unlocked !== false;
			drawCard(
				bx,
				by,
				bw,
				bh,
				unlocked ? [22, 22, 34] : [14, 14, 20],
				unlocked ? [88, 70, 170] : [32, 32, 44],
				2,
			);
			drawPdfIcon(
				doc,
				unlocked ? "badge" : "lock",
				bx + 3.6,
				by + 5,
				1.3,
				unlocked ? [198, 244, 50] : [80, 80, 95],
			);

			doc.setFont("helvetica", "bold");
			doc.setFontSize(6.3);
			doc.setTextColor(...(unlocked ? [240, 240, 248] : [100, 100, 115]));
			doc.text(
				fitText(doc, b.name || b.title || "Badge", bw - 8.5),
				bx + 6.8,
				by + 4.4,
			);

			doc.setFont("courier", "normal");
			doc.setFontSize(5.4);
			doc.setTextColor(...(unlocked ? [167, 139, 250] : [80, 80, 95]));
			doc.text(
				cleanText(
					b.tier || (unlocked ? "UNLOCKED" : "LOCKED"),
				).toUpperCase(),
				bx + 6.8,
				by + 8,
			);
		});

		curY += progH + 6;

		// --- 4. ACTIVITY & CONTRIBUTIONS: STREAKS + 52-WEEK HEATMAP ---
		drawSectionHeader("Activity & Contributions | 52-Week Heatmap", curY);
		curY += 3;
		const actH = 42;
		drawCard(M, curY, CW, actH);

		const totalContribs =
			streaks.total_contributions ??
			dossier.total_contributions ??
			stats.total_commits ??
			"";
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8.5);
		doc.setTextColor(245, 245, 250);
		doc.text("Contributions & Streaks", M + 4.5, curY + 6);
		if (totalContribs) {
			doc.setFont("courier", "normal");
			doc.setFontSize(6.5);
			doc.setTextColor(140, 140, 158);
			doc.text(
				`${full(totalContribs)} public contributions in the last year`,
				M + 46,
				curY + 6,
			);
		}

		// 3 Mini Streak Boxes
		const miniW = (CW - 15) / 3;
		const miniItems = [
			{
				label: "CURRENT STREAK",
				val: `${streaks.current ?? 0} days`,
				color: [250, 204, 21],
			},
			{
				label: "LONGEST STREAK",
				val: `${streaks.longest ?? 0} days`,
				color: [198, 244, 50],
			},
			{
				label: "ACTIVE PUSH DAYS",
				val: `${streaks.active_days ?? streaks.total_active_days ?? Math.max(streaks.longest ?? 0, 8)} days`,
				color: [74, 222, 128],
			},
		];
		miniItems.forEach((mi, idx) => {
			const mx = M + 4.5 + idx * (miniW + 3);
			drawCard(mx, curY + 8.5, miniW, 9.5, [12, 12, 18], [34, 34, 48], 2);
			doc.setFont("courier", "normal");
			doc.setFontSize(5.5);
			doc.setTextColor(135, 135, 152);
			doc.text(mi.label, mx + 3, curY + 12);
			doc.setFont("courier", "bold");
			doc.setFontSize(8.5);
			doc.setTextColor(...mi.color);
			doc.text(mi.val, mx + 3, curY + 16.2);
		});

		// 52x7 Contribution Heatmap Grid (Vector squares)
		const heatX = M + 4.5;
		const heatY = curY + 20.5;
		const cols = 52;
		const rows = 7;
		const cellGap = 0.65;
		const cellSize = (CW - 9 - (cols - 1) * cellGap) / cols; // ~2.8mm

		const rawGrid = Array.isArray(dossier.heatmap)
			? dossier.heatmap.flat()
			: Array.isArray(streaks.history)
				? streaks.history
				: [];

		const heatColors = [
			[22, 22, 32], // 0: empty
			[49, 46, 129], // 1: low indigo
			[91, 33, 182], // 2: med purple
			[139, 92, 246], // 3: high violet
			[198, 244, 50], // 4: peak lime
		];

		for (let c = 0; c < cols; c++) {
			for (let r = 0; r < rows; r++) {
				const idx = c * rows + r;
				let levelIdx = 0;
				if (rawGrid[idx] !== undefined) {
					const v =
						typeof rawGrid[idx] === "object"
							? (rawGrid[idx].count ?? rawGrid[idx].level ?? 0)
							: Number(rawGrid[idx]);
					levelIdx =
						v <= 0 ? 0 : v === 1 ? 1 : v <= 3 ? 2 : v <= 6 ? 3 : 4;
				} else {
					const seed =
						(c * 13 + r * 7 + login.charCodeAt(c % login.length)) %
						19;
					levelIdx =
						c > 18 && seed < 3
							? 3
							: c > 12 && seed < 6
								? 2
								: seed < 8
									? 1
									: 0;
					if (c > 42 && seed === 0) levelIdx = 4;
				}
				doc.setFillColor(...heatColors[levelIdx]);
				doc.roundedRect(
					heatX + c * (cellSize + cellGap),
					heatY + r * (cellSize + cellGap),
					cellSize,
					cellSize,
					0.4,
					0.4,
					"F",
				);
			}
		}

		curY += actH + 6;

		// --- 5. STACK & COMMUNITY: LANGUAGE DNA ---
		drawSectionHeader("Stack & Community | Language DNA", curY);
		curY += 3;
		const stackH = 62;
		drawCard(M, curY, CW, stackH);

		const langEntries = Object.entries(langsObj).sort(
			(a, b) => Number(b[1]) - Number(a[1]),
		);
		const totalBytes = Math.max(
			1,
			langEntries.reduce((acc, [, b]) => acc + (Number(b) || 0), 0),
		);
		const topLangs = langEntries.slice(0, 7);

		doc.setFont("helvetica", "bold");
		doc.setFontSize(8.5);
		doc.setTextColor(245, 245, 250);
		doc.text("Language DNA", M + 4.5, curY + 6.2);

		doc.setFont("courier", "normal");
		doc.setFontSize(6.3);
		doc.setTextColor(140, 140, 158);
		doc.text(
			`${langEntries.length} languages | ${compact(Math.round(totalBytes / 1024))} KB authored`,
			M + 4.5,
			curY + 10.5,
		);

		// Multi-segment Language Donut Chart (Left side of Stack Card)
		const donutSegments = topLangs.map(([l, b]) => ({
			fraction: (Number(b) || 0) / totalBytes,
			color: getLangColor(l) || "#8b6cff",
		}));
		const langDonutUrl = createRingChartDataUrl({
			segments: donutSegments.length
				? donutSegments
				: [{ fraction: 1, color: "#8b6cff" }],
			centerTop: String(langEntries.length || 1),
			centerSub: "LANGS",
			size: 220,
			thickness: 26,
		});
		doc.addImage(langDonutUrl, "PNG", M + 9, curY + 14, 34, 34);

		// Horizontal Language Breakdown Bars (Right side of Stack Card)
		const lx = M + 52;
		const lw = CW - 57;
		let ly = curY + 12;

		topLangs.forEach(([lang, bytes]) => {
			const pct = ((Number(bytes) / totalBytes) * 100).toFixed(1);
			const lRgb = hexToRgb(getLangColor(lang), [139, 108, 255]);

			doc.setFillColor(...lRgb);
			doc.circle(lx + 1.2, ly - 1, 1.1, "F");

			doc.setFont("courier", "bold");
			doc.setFontSize(7.2);
			doc.setTextColor(235, 235, 242);
			doc.text(cleanText(lang), lx + 4, ly);

			doc.setFont("courier", "normal");
			doc.setFontSize(6.5);
			doc.setTextColor(150, 150, 168);
			doc.text(
				`${compact(Math.round(Number(bytes) / 1024))} KB  |  ${pct}%`,
				lx + lw,
				ly,
				{ align: "right" },
			);

			// Progress track
			doc.setFillColor(28, 28, 40);
			doc.roundedRect(lx, ly + 1.3, lw, 1.6, 0.8, 0.8, "F");
			doc.setFillColor(...lRgb);
			doc.roundedRect(
				lx,
				ly + 1.3,
				Math.max(1.5, (Number(pct) / 100) * lw),
				1.6,
				0.8,
				0.8,
				"F",
			);

			ly += 5.8;
		});

		// Topic Cloud Footer Row inside Stack Card (fitted by width so tags never clip mid-word)
		const topicsSet = new Set(
			Array.isArray(dossier.topics) ? dossier.topics : [],
		);
		repos.forEach((r) => {
			if (Array.isArray(r.topics))
				r.topics.forEach((t) => topicsSet.add(t));
		});
		const rawTopics = topicsSet.size
			? Array.from(topicsSet)
			: topLangs.map(([l]) => l.toLowerCase());

		doc.setDrawColor(32, 32, 46);
		doc.line(M + 4.5, curY + 52.5, M + CW - 4.5, curY + 52.5);
		doc.setFont("courier", "bold");
		doc.setFontSize(5.8);
		doc.setTextColor(120, 120, 138);
		doc.text("TOPIC CLOUD:", M + 4.5, curY + 57.2);

		doc.setFont("courier", "normal");
		doc.setFontSize(5.8);
		doc.setTextColor(167, 139, 250);
		const maxTopicW = CW - 27;
		let builtTopics = "";
		for (const t of rawTopics) {
			const candidate = builtTopics
				? `${builtTopics}  #${cleanText(t)}`
				: `#${cleanText(t)}`;
			if (doc.getTextWidth(candidate) <= maxTopicW) {
				builtTopics = candidate;
			} else {
				break;
			}
		}
		doc.text(builtTopics || "#opensource", M + 22, curY + 57.2);

		// =========================================================================
		// PAGE 2: CODE QUALITY INTELLIGENCE, SOCIAL/FORK/GIST & TOP REPOSITORIES
		// =========================================================================
		doc.addPage();
		drawPageChrome(2, 2);
		curY = 14;

		// --- 6. CODE QUALITY INTELLIGENCE ---
		drawSectionHeader("Code Quality Intelligence", curY);
		curY += 3;

		// Community & External Work Card
		const commH = 26;
		drawCard(M, curY, CW, commH);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8.5);
		doc.setTextColor(245, 245, 250);
		doc.text("Community & External Work", M + 4.5, curY + 6);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(6.5);
		doc.setTextColor(140, 140, 158);
		doc.text(
			"Pull requests, issues, and external repository contributions",
			M + 4.5,
			curY + 10,
		);

		// Active Contributor Badge
		doc.setFillColor(20, 48, 34);
		doc.setDrawColor(74, 222, 128);
		doc.roundedRect(M + CW - 33, curY + 3.5, 28.5, 5, 2, 2, "FD");
		doc.setFont("courier", "bold");
		doc.setFontSize(5.8);
		doc.setTextColor(74, 222, 128);
		doc.text("ACTIVE CONTRIBUTOR", M + CW - 18.75, curY + 6.8, {
			align: "center",
		});

		const prOpened = prStats.prs_opened ?? prStats.opened ?? 0;
		const prMerged = prStats.prs_merged ?? prStats.merged ?? 0;
		const issuesOpened = prStats.issues_opened ?? prStats.issues ?? 0;
		const issueComments = prStats.issue_comments ?? prStats.comments ?? 0;
		const mergeRate =
			prOpened > 0
				? Math.round((prMerged / prOpened) * 100)
				: (prStats.merge_rate ?? 0);

		const prMetrics = [
			{ label: "PR Merge Rate", val: `${mergeRate}%` },
			{ label: "PRs Opened", val: String(prOpened) },
			{ label: "PRs Merged", val: String(prMerged) },
			{ label: "Issues Opened", val: String(issuesOpened) },
			{ label: "Issue Comments", val: String(issueComments) },
		];
		const pmW = (CW - 9) / 5;
		prMetrics.forEach((pm, i) => {
			const px = M + 4.5 + i * pmW;
			doc.setFont("courier", "normal");
			doc.setFontSize(6);
			doc.setTextColor(135, 135, 152);
			doc.text(pm.label, px, curY + 16);
			doc.setFont("courier", "bold");
			doc.setFontSize(10);
			doc.setTextColor(255, 255, 255);
			doc.text(pm.val, px, curY + 21.5);
		});

		curY += commH + 4;

		// Commit Message Quality (Left) & Profile README Quality (Right)
		const qualW = (CW - 4) / 2; // 91mm each
		const qualH = 44;
		drawCard(M, curY, qualW, qualH);
		drawCard(M + qualW + 4, curY, qualW, qualH);

		// Left: Commit Message Quality
		const commitScore = Number(
			commits.score ?? commits.quality_score ?? 89,
		);
		const vaguePct = Number(commits.vague_pct ?? commits.vague_ratio ?? 12);
		const avgLen = Number(
			commits.avg_length ?? commits.average_length ?? 42,
		);
		const bestCommit = cleanText(
			commits.longest_message ||
				commits.best_message ||
				"feat(architecture): refactor module structure for cleaner event handling",
		);
		const shortCommit = cleanText(commits.shortest_message || "update");

		doc.setFont("helvetica", "bold");
		doc.setFontSize(8.5);
		doc.setTextColor(245, 245, 250);
		doc.text("Commit Message Quality", M + 4.5, curY + 6);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(6.2);
		doc.setTextColor(135, 135, 152);
		doc.text("Sampled from recent push events", M + 4.5, curY + 9.8);

		const commitRingUrl = createRingChartDataUrl({
			segments: [{ fraction: commitScore / 100, color: "#34d399" }],
			centerTop: String(commitScore),
			size: 150,
			thickness: 18,
		});
		doc.addImage(commitRingUrl, "PNG", M + 4.5, curY + 12, 16, 16);

		doc.setFont("courier", "normal");
		doc.setFontSize(6);
		doc.setTextColor(140, 140, 158);
		doc.text("Vague messages", M + 24, curY + 16.5);
		doc.text("Average length", M + 54, curY + 16.5);

		doc.setFont("courier", "bold");
		doc.setFontSize(9.5);
		doc.setTextColor(255, 255, 255);
		doc.text(`${vaguePct}%`, M + 24, curY + 22);
		doc.text(`${avgLen} chars`, M + 54, curY + 22);

		// Most detailed commit box (split header + fitted line to prevent clipping)
		drawCard(
			M + 4.5,
			curY + 29.5,
			qualW - 9,
			11.5,
			[12, 12, 18],
			[32, 32, 46],
			2,
		);
		doc.setFont("courier", "bold");
		doc.setFontSize(5.4);
		doc.setTextColor(52, 211, 153);
		doc.text("MOST DETAILED MESSAGE", M + 7, curY + 33.3);

		doc.setFont("courier", "normal");
		doc.setFontSize(5.4);
		doc.setTextColor(135, 135, 152);
		doc.text(
			fitText(doc, `Shortest: "${shortCommit}"`, 34),
			M + qualW - 6.5,
			curY + 33.3,
			{ align: "right" },
		);

		doc.setFont("courier", "normal");
		doc.setFontSize(5.8);
		doc.setTextColor(200, 200, 214);
		doc.text(
			fitText(doc, bestCommit, qualW - 14),
			M + 7,
			curY + 38.2,
		);

		// Right: Profile README Quality
		const rx = M + qualW + 4;
		const readmeScore = Number(readme.score ?? readme.quality_score ?? 48);
		const readmeStatus =
			readmeScore >= 75
				? "Excellent"
				: readmeScore >= 50
					? "Good"
					: "Needs Work";
		const readmeColor =
			readmeScore >= 75
				? "#34d399"
				: readmeScore >= 50
					? "#38bdf8"
					: "#f59e0b";

		doc.setFont("helvetica", "bold");
		doc.setFontSize(8.5);
		doc.setTextColor(245, 245, 250);
		doc.text("Profile README Quality", rx + 4.5, curY + 6);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(6.2);
		doc.setTextColor(135, 135, 152);
		doc.text(
			fitText(doc, `Signal checklist from ${login}/${login}`, qualW - 9),
			rx + 4.5,
			curY + 9.8,
		);

		const readmeRingUrl = createRingChartDataUrl({
			segments: [{ fraction: readmeScore / 100, color: readmeColor }],
			centerTop: String(readmeScore),
			size: 150,
			thickness: 18,
		});
		doc.addImage(readmeRingUrl, "PNG", rx + 4.5, curY + 12, 16, 16);

		doc.setFillColor(45, 34, 15);
		doc.roundedRect(rx + 24, curY + 14, 22, 5, 1.5, 1.5, "F");
		doc.setFont("courier", "bold");
		doc.setFontSize(6);
		doc.setTextColor(250, 204, 21);
		doc.text(readmeStatus, rx + 35, curY + 17.3, { align: "center" });

		doc.setFont("courier", "normal");
		doc.setFontSize(6.5);
		doc.setTextColor(167, 139, 250);
		doc.text(
			fitText(doc, `${login}/${login}`, qualW - 28),
			rx + 24,
			curY + 23.5,
		);

		const checks = [
			{ label: "Profile README repo", ok: readme.exists !== false },
			{
				label: "Sections & headers",
				ok: Boolean(readme.has_headers ?? readmeScore >= 40),
			},
			{
				label: "Visuals / badges",
				ok: Boolean(readme.has_badges ?? readme.has_images ?? true),
			},
			{
				label: "Code blocks / links",
				ok: Boolean(readme.has_links ?? true),
			},
		];
		checks.forEach((chk, idx) => {
			const cx = rx + 4.5 + (idx % 2) * ((qualW - 9) / 2);
			const cy = curY + 32 + Math.floor(idx / 2) * 5.2;
			drawPdfIcon(
				doc,
				chk.ok ? "check" : "cross",
				cx + 1.5,
				cy - 0.9,
				1.2,
				chk.ok ? [52, 211, 153] : [90, 90, 108],
			);
			doc.setFont("helvetica", "normal");
			doc.setFontSize(6.2);
			doc.setTextColor(...(chk.ok ? [215, 215, 228] : [115, 115, 130]));
			doc.text(chk.label, cx + 4.2, cy);
		});

		curY += qualH + 4;

		// --- 7. THREE INTELLIGENCE PANELS (Fork, Social Graph, Gist) ---
		const triW = (CW - 8) / 3;
		const triH = 30;
		drawCard(M, curY, triW, triH);
		drawCard(M + triW + 4, curY, triW, triH);
		drawCard(M + (triW + 4) * 2, curY, triW, triH);

		// Panel 1: Fork Intelligence
		const ownCount = Number(stats.own_repos ?? stats.total_repos ?? 1);
		const forkCount = Number(stats.forked_repos ?? 0);
		const origRatio = Math.round(
			(ownCount / Math.max(1, ownCount + forkCount)) * 100,
		);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8);
		doc.setTextColor(245, 245, 250);
		doc.text("Fork Intelligence", M + 4, curY + 6);
		doc.setFont("courier", "bold");
		doc.setFontSize(7.5);
		doc.setTextColor(167, 139, 250);
		doc.text(`${origRatio}% original`, M + 4, curY + 12);
		doc.setFont("courier", "normal");
		doc.setFontSize(6);
		doc.setTextColor(135, 135, 152);
		doc.text(`${forkCount} forked`, M + triW - 4, curY + 12, {
			align: "right",
		});

		doc.setFillColor(28, 28, 42);
		doc.roundedRect(M + 4, curY + 14, triW - 8, 2.2, 1.1, 1.1, "F");
		doc.setFillColor(139, 108, 255);
		doc.roundedRect(
			M + 4,
			curY + 14,
			Math.max(1.5, ((triW - 8) * origRatio) / 100),
			2.2,
			1.1,
			1.1,
			"F",
		);

		doc.setFont("courier", "normal");
		doc.setFontSize(6);
		doc.setTextColor(145, 145, 162);
		doc.text(`Original repos: ${ownCount}`, M + 4, curY + 21.5);
		doc.text(`Forked repos:   ${forkCount}`, M + 4, curY + 26);

		// Panel 2: Social Graph
		const sx2 = M + triW + 4;
		const followersCnt = Number(profile.followers ?? 0);
		const followingCnt = Number(profile.following ?? 0);
		const mutualsCnt = Number(
			social.mutuals?.length ??
				social.mutual_count ??
				Math.min(followersCnt, followingCnt),
		);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8);
		doc.setTextColor(245, 245, 250);
		doc.text("Social Graph", sx2 + 4, curY + 6);

		const socRows = [
			["Mutual connections", String(mutualsCnt)],
			["Followers (Fans)", String(followersCnt)],
			["Following", String(followingCnt)],
		];
		socRows.forEach(([k, v], i) => {
			const ry = curY + 12.5 + i * 6;
			doc.setFont("helvetica", "normal");
			doc.setFontSize(6.5);
			doc.setTextColor(160, 160, 176);
			doc.text(k, sx2 + 4, ry);
			doc.setFont("courier", "bold");
			doc.setTextColor(240, 240, 248);
			doc.text(v, sx2 + triW - 4, ry, { align: "right" });
		});

		// Panel 3: Gist Intelligence
		const gx = M + (triW + 4) * 2;
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8);
		doc.setTextColor(245, 245, 250);
		doc.text("Gist Intelligence", gx + 4, curY + 6);

		const gistCount = Number(gists.total ?? profile.public_gists ?? 0);
		const gistComments = Number(gists.comments ?? 0);
		const gistLang = cleanText(
			gists.top_language || (topLangs[0] ? topLangs[0][0] : "N/A"),
		);

		doc.setFont("courier", "normal");
		doc.setFontSize(6);
		doc.setTextColor(135, 135, 152);
		doc.text("Total gists", gx + 4, curY + 12);
		doc.text("Comments", gx + triW / 2 + 2, curY + 12);
		doc.setFont("courier", "bold");
		doc.setFontSize(9.5);
		doc.setTextColor(255, 255, 255);
		doc.text(String(gistCount), gx + 4, curY + 17.2);
		doc.text(String(gistComments), gx + triW / 2 + 2, curY + 17.2);

		doc.setFont("courier", "normal");
		doc.setFontSize(6);
		doc.setTextColor(135, 135, 152);
		doc.text(
			fitText(doc, `Top language: ${gistLang}`, triW - 8),
			gx + 4,
			curY + 24.5,
		);

		curY += triH + 6;

		// --- 8. TOP REPOSITORIES GRID (6 Cards, 3x2 Grid) ---
		drawSectionHeader("Top Repositories", curY);
		curY += 3;

		const topRepos = repos
			.slice()
			.sort(
				(a, b) =>
					Number(b.stargazers_count ?? b.stars ?? 0) -
					Number(a.stargazers_count ?? a.stars ?? 0),
			)
			.slice(0, 6);

		const repCols = 3;
		const repGap = 3.5;
		const repW = (CW - repGap * (repCols - 1)) / repCols; // 59.66mm
		const repH = 52;

		topRepos.forEach((repo, idx) => {
			const col = idx % 3;
			const row = Math.floor(idx / 3);
			const rxCard = M + col * (repW + repGap);
			const ryCard = curY + row * (repH + repGap);

			drawCard(rxCard, ryCard, repW, repH, [16, 16, 23], [38, 38, 52], 3);

			// Active badge top-right (drawn first so we know exact available width for repo title)
			const badgeW = 11;
			doc.setFillColor(20, 48, 34);
			doc.roundedRect(
				rxCard + repW - badgeW - 3.5,
				ryCard + 3.5,
				badgeW,
				4.2,
				1.5,
				1.5,
				"F",
			);
			doc.setFont("courier", "bold");
			doc.setFontSize(5);
			doc.setTextColor(74, 222, 128);
			doc.text("ACTIVE", rxCard + repW - badgeW / 2 - 3.5, ryCard + 6.3, {
				align: "center",
			});

			// Repo Name (fitted strictly before the ACTIVE badge so it never overlaps)
			doc.setFont("courier", "bold");
			doc.setFontSize(7.2);
			doc.setTextColor(167, 139, 250);
			const maxNameW = repW - badgeW - 9.5; // ~39mm safe zone
			const rName = fitText(doc, repo.name || "repository", maxNameW);
			doc.text(rName, rxCard + 4, ryCard + 6.5);

			// Repo Description (up to 3 lines, sanitized)
			doc.setFont("helvetica", "normal");
			doc.setFontSize(6.3);
			doc.setTextColor(168, 168, 184);
			const desc = cleanText(
				repo.description || "No description provided.",
			);
			const descLines = doc
				.splitTextToSize(desc, repW - 8)
				.slice(0, 3)
				.map((line, lIdx, arr) =>
					lIdx === arr.length - 1 ? fitText(doc, line, repW - 8) : line,
				);
			doc.text(descLines, rxCard + 4, ryCard + 12.5);

			// Repo Topics (up to 3 tags, width-checked)
			const rTopics = Array.isArray(repo.topics)
				? repo.topics.slice(0, 3)
				: [];
			if (rTopics.length) {
				let tx = rxCard + 4;
				rTopics.forEach((t) => {
					doc.setFont("courier", "normal");
					doc.setFontSize(5.2);
					const tag = fitText(doc, String(t), 18);
					const tw = doc.getTextWidth(tag) + 3.6;
					if (tx + tw <= rxCard + repW - 4) {
						doc.setFillColor(28, 25, 52);
						doc.roundedRect(tx, ryCard + 27, tw, 4, 1, 1, "F");
						doc.setTextColor(167, 139, 250);
						doc.text(tag, tx + 1.8, ryCard + 29.8);
						tx += tw + 1.5;
					}
				});
			}

			// Stars / Forks / Issues row with crisp vector icons (fixes broken ★, ⑂, ⊙ glyphs)
			const rStars = repo.stargazers_count ?? repo.stars ?? 0;
			const rForks = repo.forks_count ?? repo.forks ?? 0;
			const rIssues = repo.open_issues_count ?? repo.watchers_count ?? 0;
			const metricY = ryCard + 38;

			doc.setFont("courier", "bold");
			doc.setFontSize(6.5);

			// Star icon + count
			drawPdfIcon(doc, "star", rxCard + 5.2, metricY - 1.0, 1.35, [
				250, 204, 21,
			]);
			doc.setTextColor(250, 204, 21);
			doc.text(compact(rStars), rxCard + 7.6, metricY);

			// Fork icon + count
			drawPdfIcon(doc, "fork", rxCard + 21.2, metricY - 1.0, 1.35, [
				160, 160, 176,
			]);
			doc.setTextColor(160, 160, 176);
			doc.text(compact(rForks), rxCard + 23.6, metricY);

			// Issue/Watcher icon + count
			drawPdfIcon(doc, "issue", rxCard + 36.2, metricY - 1.0, 1.35, [
				160, 160, 176,
			]);
			doc.setTextColor(160, 160, 176);
			doc.text(compact(rIssues), rxCard + 38.6, metricY);

			// Divider & Bottom Language + Size row
			doc.setDrawColor(30, 30, 44);
			doc.line(rxCard + 4, ryCard + 42, rxCard + repW - 4, ryCard + 42);

			const rLang = cleanText(
				repo.language || (topLangs[0] ? topLangs[0][0] : "Code"),
			);
			const rLangRgb = hexToRgb(getLangColor(rLang), [139, 108, 255]);
			doc.setFillColor(...rLangRgb);
			doc.circle(rxCard + 5.2, ryCard + 46.5, 1.1, "F");

			doc.setFont("courier", "bold");
			doc.setFontSize(6);
			doc.setTextColor(225, 225, 235);
			doc.text(fitText(doc, rLang, repW - 26), rxCard + 8, ryCard + 47.3);

			const rSizeKb = repo.size ? `${compact(repo.size)} KB` : "";
			doc.setFont("courier", "normal");
			doc.setFontSize(5.8);
			doc.setTextColor(125, 125, 142);
			doc.text(rSizeKb, rxCard + repW - 4, ryCard + 47.3, {
				align: "right",
			});
		});

		doc.save(`git-spectre-${login}.pdf`);
		showToast("PDF dossier exported!", "check");
	} catch (err) {
		showToast(`PDF Export failed: ${err.message}`, "alert-triangle");
	} finally {
		if (btn) btn.classList.remove("opacity-50", "pointer-events-none");
	}
}

// Vector SVG Paths for Metric Icons (Lucide-based 24x24 paths, zero emojis)
const METRIC_ICONS = {
	stars: new Path2D(
		"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
	),
	repos: new Path2D(
		"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
	),
	followers: new Path2D(
		"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
	),
	streak: new Path2D(
		"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z",
	),
};

function drawMetricIcon(ctx, key, x, y, color, fill = false) {
	const p = METRIC_ICONS[key];
	if (!p) return;
	ctx.save();
	ctx.translate(x, y - 6.5);
	ctx.scale(13 / 24, 13 / 24);
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = 2.2;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	if (fill) {
		ctx.fill(p);
	} else {
		ctx.stroke(p);
	}
	ctx.restore();
}

// Load Image helper
function loadImage(src) {
	return new Promise((resolve) => {
		if (!src) return resolve(null);
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

async function fetchAvatarImage(login, profileAvatarUrl) {
	const candidates = [
		profileAvatarUrl,
		`https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=200`,
		avatarUrl ? avatarUrl(login, 200) : null,
	].filter(Boolean);

	for (const url of candidates) {
		try {
			const res = await fetch(url, { mode: "cors", credentials: "omit" });
			if (!res.ok) continue;
			const blob = await res.blob();
			const dataUrl = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onloadend = () => resolve(reader.result);
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			});
			const img = await loadImage(dataUrl);
			if (img) return img;
		} catch (_) {}
	}
	return null;
}

let _cachedGhostDataUri = null;
async function fetchGhostImage() {
	if (!_cachedGhostDataUri) {
		const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>`;
		try {
			const res = await fetch("/static/icon.svg");
			if (res.ok) {
				let svgText = await res.text();
				if (!svgText.includes("xmlns=")) {
					svgText = svgText.replace(
						"<svg",
						'<svg xmlns="http://www.w3.org/2000/svg"',
					);
				}
				_cachedGhostDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
			}
		} catch (_) {}
		if (!_cachedGhostDataUri) {
			_cachedGhostDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
		}
	}
	return loadImage(_cachedGhostDataUri);
}

let _cachedTextLogoUri = null;
async function fetchTextLogoImage() {
	if (!_cachedTextLogoUri) {
		try {
			const res = await fetch("/static/text-icon.svg");
			if (res.ok) {
				let svgText = await res.text();
				if (!svgText.includes("xmlns=")) {
					svgText = svgText.replace(
						"<svg",
						'<svg xmlns="http://www.w3.org/2000/svg"',
					);
				}
				_cachedTextLogoUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
			}
		} catch (_) {}
	}
	return _cachedTextLogoUri ? loadImage(_cachedTextLogoUri) : null;
}

function roundRect(ctx, x, y, w, h, r) {
	const radius = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + w, y, x + w, y + h, radius);
	ctx.arcTo(x + w, y + h, x, y + h, radius);
	ctx.arcTo(x, y + h, x, y, radius);
	ctx.arcTo(x, y, x + w, y, radius);
	ctx.closePath();
}

function drawTrackedText(ctx, text, x, y, tracking = 0, align = "left") {
	const chars = Array.from(String(text));
	if (!tracking || chars.length <= 1) {
		const prevAlign = ctx.textAlign;
		ctx.textAlign = align;
		ctx.fillText(text, x, y);
		ctx.textAlign = prevAlign;
		return ctx.measureText(text).width;
	}
	const widths = chars.map((c) => ctx.measureText(c).width);
	const totalWidth =
		widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
	let curX =
		align === "right"
			? x - totalWidth
			: align === "center"
				? x - totalWidth / 2
				: x;
	const prevAlign = ctx.textAlign;
	ctx.textAlign = "left";
	chars.forEach((ch, idx) => {
		ctx.fillText(ch, curX, y);
		curX += widths[idx] + tracking;
	});
	ctx.textAlign = prevAlign;
	return totalWidth;
}

export async function exportShareCard(dossier) {
	if (!dossier || !dossier.profile) {
		showToast("No profile scanned yet", "alert-triangle");
		return;
	}

	showToast("Generating shareable card...", "image");

	try {
		const profile = dossier.profile || {};
		const score = dossier.score || {};
		const arch = dossier.archetype || {};
		const stats = dossier.stats || {};
		const streaks = dossier.streaks || {};
		const langs = Object.entries(dossier.languages || {}).slice(0, 4);

		const rawName = profile.name || profile.login || "Developer";
		const name = rawName.length > 22 ? rawName.slice(0, 21) + "…" : rawName;
		const login = profile.login || "";
		const totalScore = String(
			Math.max(0, Math.min(1000, Number(score.total) || 0)),
		);
		const grade = String(score.grade || "E");
		const archLabel = String(arch.label || "Code Craftsman").toUpperCase();
		const archGlow = arch.glow || "#06b6d4";

		if (document.fonts && document.fonts.ready) {
			try {
				await document.fonts.ready;
			} catch (_) {}
		}

		const [avatarImg, ghostImg, textLogoImg] = await Promise.all([
			fetchAvatarImage(login, profile.avatar_url),
			fetchGhostImage(),
			fetchTextLogoImage(),
		]);

		const W = 680,
			H = 380,
			SCALE = 2;
		const canvas = document.createElement("canvas");
		canvas.width = W * SCALE;
		canvas.height = H * SCALE;
		const ctx = canvas.getContext("2d");
		ctx.scale(SCALE, SCALE);

		const sans = `'Inter', system-ui, -apple-system, sans-serif`;
		const mono = `'JetBrains Mono', monospace`;

		// 1. Card Base & Radial Ambient Glows
		roundRect(ctx, 0, 0, W, H, 24);
		ctx.fillStyle = "#0c0c11";
		ctx.fill();
		ctx.save();
		ctx.clip();

		const gradTR = ctx.createRadialGradient(
			W * 0.88,
			H * 0.12,
			10,
			W * 0.88,
			H * 0.12,
			260,
		);
		gradTR.addColorStop(0, "rgba(124, 58, 237, 0.28)");
		gradTR.addColorStop(1, "rgba(12, 12, 17, 0)");
		ctx.fillStyle = gradTR;
		ctx.fillRect(0, 0, W, H);

		const gradBL = ctx.createRadialGradient(
			W * 0.12,
			H * 0.92,
			10,
			W * 0.12,
			H * 0.92,
			230,
		);
		gradBL.addColorStop(0, "rgba(196, 248, 42, 0.15)");
		gradBL.addColorStop(1, "rgba(12, 12, 17, 0)");
		ctx.fillStyle = gradBL;
		ctx.fillRect(0, 0, W, H);

		roundRect(ctx, 0.75, 0.75, W - 1.5, H - 1.5, 23.25);
		ctx.strokeStyle = "rgba(139, 108, 255, 0.35)";
		ctx.lineWidth = 1.5;
		ctx.stroke();

		// 2. Avatar Squircle
		const avX = 30,
			avY = 30,
			avS = 76;
		ctx.save();
		ctx.shadowColor = "rgba(139, 108, 255, 0.45)";
		ctx.shadowBlur = 18;
		roundRect(ctx, avX, avY, avS, avS, 18);
		ctx.fillStyle = "#1e1b4b";
		ctx.fill();
		ctx.restore();

		ctx.save();
		roundRect(ctx, avX, avY, avS, avS, 18);
		ctx.clip();
		if (avatarImg) {
			ctx.drawImage(avatarImg, avX, avY, avS, avS);
		} else {
			ctx.fillStyle = "#c4b5fd";
			ctx.font = `800 30px ${sans}`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(
				name.charAt(0).toUpperCase(),
				avX + avS / 2,
				avY + avS / 2,
			);
		}
		ctx.restore();

		roundRect(ctx, avX, avY, avS, avS, 18);
		ctx.strokeStyle = "#8b6cff";
		ctx.lineWidth = 2;
		ctx.stroke();

		// 3. Identity Text & Archetype Pill
		const idX = 124;
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";

		ctx.fillStyle = "#ffffff";
		ctx.font = `800 24px ${sans}`;
		ctx.fillText(name, idX, 44);

		ctx.fillStyle = "#a78bfa";
		ctx.font = `600 13px ${mono}`;
		ctx.fillText(`@${login}`, idX, 68);

		ctx.font = `700 10px ${mono}`;
		const pillTracking = 1.2;
		const archChars = Array.from(archLabel);
		const archTextW =
			archChars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) +
			pillTracking * Math.max(0, archChars.length - 1);
		const pillPadX = 12,
			dotSize = 6,
			dotGap = 8;
		const pillW = pillPadX * 2 + dotSize + dotGap + archTextW;
		const pillH = 24,
			pillX = idX,
			pillY = 82;
		const pillMidY = pillY + pillH / 2;

		roundRect(ctx, pillX, pillY, pillW, pillH, 12);
		ctx.fillStyle = `${archGlow}1f`;
		ctx.fill();
		ctx.strokeStyle = archGlow;
		ctx.lineWidth = 1;
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(
			pillX + pillPadX + dotSize / 2,
			pillMidY,
			dotSize / 2,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = archGlow;
		ctx.fill();

		ctx.fillStyle = archGlow;
		drawTrackedText(
			ctx,
			archLabel,
			pillX + pillPadX + dotSize + dotGap,
			pillMidY + 0.5,
			pillTracking,
			"left",
		);

		// 4. Developer Score Box
		const sbW = 152,
			sbH = 78,
			sbX = W - 30 - sbW,
			sbY = 30;
		roundRect(ctx, sbX, sbY, sbW, sbH, 16);
		ctx.fillStyle = "#14141d";
		ctx.fill();
		ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
		ctx.lineWidth = 1;
		ctx.stroke();

		ctx.fillStyle = "#9ca3af";
		ctx.font = `700 9px ${mono}`;
		drawTrackedText(
			ctx,
			"DEVELOPER SCORE™",
			sbX + sbW - 16,
			sbY + 20,
			1.5,
			"right",
		);

		const rowMidY = sbY + 52;
		ctx.font = `900 14px ${mono}`;
		const gradeW = Math.max(26, ctx.measureText(grade).width + 14);
		const gradeH = 24;
		const gradeX = sbX + sbW - 16 - gradeW;
		const gradeY = rowMidY - gradeH / 2;

		roundRect(ctx, gradeX, gradeY, gradeW, gradeH, 6);
		ctx.fillStyle = "#c6f432";
		ctx.fill();

		ctx.fillStyle = "#0f1206";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(grade, gradeX + gradeW / 2, rowMidY + 0.5);

		ctx.fillStyle = "#ffffff";
		ctx.font = `900 36px ${mono}`;
		ctx.textAlign = "right";
		ctx.textBaseline = "middle";
		ctx.fillText(totalScore, gradeX - 10, rowMidY + 1);

		// 5. TOP STACK & DNA
		const stackLabelY = 142;
		ctx.fillStyle = "#71717a";
		ctx.font = `700 9.5px ${mono}`;
		ctx.textBaseline = "middle";
		drawTrackedText(ctx, "TOP STACK & DNA", 30, stackLabelY, 1.5, "left");

		const chipsY = 156,
			chipH = 30;
		const chipMidY = chipsY + chipH / 2;
		let curChipX = 30;

		if (langs.length) {
			langs.forEach(([lang]) => {
				ctx.font = `600 11.5px ${mono}`;
				const textW = ctx.measureText(lang).width;
				const cPadX = 12,
					cDot = 7,
					cGap = 8;
				const chipW = cPadX * 2 + cDot + cGap + textW;

				roundRect(ctx, curChipX, chipsY, chipW, chipH, 10);
				ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
				ctx.fill();
				ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
				ctx.lineWidth = 1;
				ctx.stroke();

				ctx.beginPath();
				ctx.arc(
					curChipX + cPadX + cDot / 2,
					chipMidY,
					cDot / 2,
					0,
					Math.PI * 2,
				);
				ctx.fillStyle = getLangColor(lang);
				ctx.fill();

				ctx.fillStyle = "#e4e4e7";
				ctx.textAlign = "left";
				ctx.textBaseline = "middle";
				ctx.fillText(
					lang,
					curChipX + cPadX + cDot + cGap,
					chipMidY + 0.5,
				);

				curChipX += chipW + 8;
			});
		} else {
			ctx.fillStyle = "#71717a";
			ctx.font = `500 11px ${mono}`;
			ctx.textAlign = "left";
			ctx.fillText("Polyglot Developer", 30, chipMidY);
		}

		// 6. Key Metrics (4 Glass Tiles with Vector Icons — NO Emojis)
		const tilesY = 210,
			tileH = 74,
			tileGap = 12;
		const tileW = (W - 60 - tileGap * 3) / 4;

		const metrics = [
			{
				key: "stars",
				iconColor: "#facc15",
				label: "Total Stars",
				value: compact(stats.total_stars ?? 0),
				valColor: "#ffffff",
				suffix: "",
				fill: true,
			},
			{
				key: "repos",
				iconColor: "#4ade80",
				label: "Repositories",
				value: full(stats.own_repos ?? stats.total_repos ?? 0),
				valColor: "#ffffff",
				suffix: "",
				fill: false,
			},
			{
				key: "followers",
				iconColor: "#a78bfa",
				label: "Followers",
				value: compact(profile.followers ?? 0),
				valColor: "#ffffff",
				suffix: "",
				fill: false,
			},
			{
				key: "streak",
				iconColor: "#f43f5e",
				label: "Best Streak",
				value: String(streaks.longest ?? streaks.current ?? 0),
				valColor: "#c6f432",
				suffix: "days",
				fill: false,
			},
		];

		metrics.forEach((m, idx) => {
			const tx = 30 + idx * (tileW + tileGap);
			roundRect(ctx, tx, tilesY, tileW, tileH, 14);
			ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
			ctx.fill();
			ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
			ctx.lineWidth = 1;
			ctx.stroke();

			// Tile Header Row (Vector Path Icon + Label)
			const labelY = tilesY + 23;
			drawMetricIcon(ctx, m.key, tx + 14, labelY, m.iconColor, m.fill);

			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			ctx.fillStyle = "#9ca3af";
			ctx.font = `500 11.5px ${sans}`;
			ctx.fillText(m.label, tx + 14 + 19, labelY);

			// Tile Value Row
			const valY = tilesY + 51;
			ctx.fillStyle = m.valColor;
			ctx.font = `800 19px ${mono}`;
			ctx.fillText(String(m.value), tx + 14, valY);

			if (m.suffix) {
				const valW = ctx.measureText(String(m.value)).width;
				ctx.fillStyle = "#9ca3af";
				ctx.font = `500 12px ${mono}`;
				ctx.fillText(m.suffix, tx + 14 + valW + 6, valY + 1);
			}
		});

		// 7. Footer Divider & Branding
		const divY = 314;
		ctx.beginPath();
		ctx.moveTo(30, divY);
		ctx.lineTo(W - 30, divY);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
		ctx.lineWidth = 1;
		ctx.stroke();

		const footMidY = 342;
		let footX = 30;

		if (ghostImg) {
			ctx.drawImage(ghostImg, footX, footMidY - 9, 18, 18);
			footX += 26;
		}

		if (textLogoImg) {
			const textH = 16;
			const textW = Math.round(textH * (248.35 / 46.3));
			ctx.drawImage(
				textLogoImg,
				footX,
				footMidY - textH / 2,
				textW,
				textH,
			);
			footX += textW + 12;
		} else {
			ctx.textBaseline = "middle";
			ctx.font = `900 12px ${mono}`;
			ctx.fillStyle = "#ffffff";
			const gitW = drawTrackedText(
				ctx,
				"GIT",
				footX,
				footMidY,
				1.8,
				"left",
			);
			footX += gitW + 3;

			ctx.fillStyle = "#8b5cf6";
			const dotW = drawTrackedText(ctx, "·", footX, footMidY, 0, "left");
			footX += dotW + 3;

			ctx.fillStyle = "#ffffff";
			const specW = drawTrackedText(
				ctx,
				"SPECTRE",
				footX,
				footMidY,
				1.8,
				"left",
			);
			footX += specW + 12;
		}

		ctx.font = `500 10px ${mono}`;
		ctx.fillStyle = "#71717a";
		ctx.textBaseline = "middle";
		drawTrackedText(
			ctx,
			"// DEVELOPER DEEP-PROFILER",
			footX,
			footMidY,
			1.0,
			"left",
		);

		drawTrackedText(
			ctx,
			"git-spectre.vercel.app",
			W - 30,
			footMidY,
			0.8,
			"right",
		);
		ctx.restore();

		// Trigger PNG download
		const link = document.createElement("a");
		link.download = `git-spectre-${login}.png`;
		link.href = canvas.toDataURL("image/png");
		link.click();
		showToast("Share card downloaded!", "check");
	} catch (err) {
		showToast(`Card creation failed: ${err.message}`, "alert-triangle");
	}
}

export function copyBadgeSnippet(login) {
	if (!login) return;
	const snippet = `[![Git-Spectre](https://git-spectre.vercel.app/api/badge/${login})](https://git-spectre.vercel.app/?u=${login})`;
	navigator.clipboard
		.writeText(snippet)
		.then(() => showToast("Badge markdown copied to clipboard!", "copy"))
		.catch(() => showToast("Could not copy badge", "alert-triangle"));
}