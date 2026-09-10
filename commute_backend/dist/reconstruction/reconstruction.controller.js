"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconstructionController = void 0;
const common_1 = require("@nestjs/common");
const reconstruction_service_1 = require("./reconstruction.service");
let ReconstructionController = class ReconstructionController {
    constructor(recon) {
        this.recon = recon;
    }
    // GET /reconstruct/<id>/view?key=<API_KEY>  — browser-openable HTML
    async view(id, req) {
        const provided = req.headers['x-api-key'] ?? req.query.key;
        if (!process.env.API_KEY || provided !== process.env.API_KEY) {
            throw new common_1.UnauthorizedException('Invalid or missing API key');
        }
        const r = await this.recon.reconstruct(id);
        if (!r)
            return `<h1>Trip ${esc(id)} not found</h1>`;
        return render(r);
    }
};
exports.ReconstructionController = ReconstructionController;
__decorate([
    (0, common_1.Get)(':id/view'),
    (0, common_1.Header)('Content-Type', 'text/html; charset=utf-8'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReconstructionController.prototype, "view", null);
exports.ReconstructionController = ReconstructionController = __decorate([
    (0, common_1.Controller)('reconstruct'),
    __metadata("design:paramtypes", [reconstruction_service_1.ReconstructionService])
], ReconstructionController);
// --- server-side HTML (no template engine) ---
function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const IST = (d) => new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
}).format(new Date(d));
const kmh = (ms) => (ms * 3.6).toFixed(1);
function legRows(legs) {
    if (!legs.length)
        return `<tr><td colspan="3">(no GPS samples)</td></tr>`;
    return legs
        .map((l) => {
        const mins = (l.seconds / 60).toFixed(1);
        const label = l.state === 'moving' ? '🚶/🚗 Moving' : '⏸ Still';
        const spd = l.state === 'moving'
            ? ` · avg ${kmh(l.avgSpeed)} / max ${kmh(l.maxSpeed)} km/h`
            : '';
        return `<tr><td>${label}</td>
        <td>${esc(IST(l.startedAt))} – ${esc(IST(l.endedAt))}</td>
        <td style="text-align:right">${mins} min${spd}</td></tr>`;
    })
        .join('');
}
function labelRows(labels) {
    if (!labels.length)
        return `<tr><td colspan="3">(none)</td></tr>`;
    return labels
        .map((l) => {
        const mins = ((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 60000).toFixed(1);
        return `<tr><td>${esc(l.mode)}</td>
        <td>${esc(IST(l.started_at))} – ${esc(IST(l.ended_at))}</td>
        <td style="text-align:right">${mins} min</td></tr>`;
    })
        .join('');
}
function render(r) {
    const t = r.trip;
    return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reconstruct ${esc(t.id)}</title>
<style>
 body{font:16px/1.5 system-ui,sans-serif;max-width:660px;margin:24px auto;padding:0 16px;color:#111}
 h1{font-size:20px;margin:0 0 2px}.sub{color:#666;margin:0 0 20px}
 h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#555;margin:24px 0 6px}
 table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #eee}
 .note{color:#888;font-size:13px;margin-top:18px}
</style></head><body>
 <h1>Reconstruction v1 · Volunteer ${esc(t.volunteer_code)}</h1>
 <p class="sub">${esc(IST(t.started_at))} → ${esc(t.ended_at ? IST(t.ended_at) : '(open)')} · ${r.sampleCount} GPS samples</p>
 <h2>Backend segmentation (moving / still)</h2>
 <table>${legRows(r.legs)}</table>
 <h2>Volunteer's manual labels</h2>
 <table>${labelRows(r.labels)}</table>
 <p class="note">v1 splits movement only. Mode (walk / e-rickshaw / car / metro), waiting, and ride-start come in the next steps.</p>
</body></html>`;
}
//# sourceMappingURL=reconstruction.controller.js.map