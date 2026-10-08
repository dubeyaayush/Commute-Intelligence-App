import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { CommuteService } from "../commute/commute.service"; // adjust path if different

@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly commute: CommuteService,
  ) {}

  // GET /admin/trips?volunteer=&quality=&limit=&key=  — all trips (dashboard list).
  @Get("trips")
  async trips(
    @Req() req: any,
    @Query("volunteer") volunteer?: string,
    @Query("quality") quality?: string,
    @Query("limit") limit?: string,
  ) {
    this.checkKey(req);
    return this.admin.listTrips({ volunteer, quality, limit });
  }

  // GET /admin/trips/<id>?key=  — one trip's full analysis + GPS track + labels.
  @Get("trips/:id")
  async trip(@Param("id") id: string, @Req() req: any) {
    this.checkKey(req);
    const t = await this.admin.getTrip(id);
    if (!t) throw new NotFoundException(`Trip ${id} not analysed / not found`);
    return t;
  }

  // GET /admin/volunteers?key=  — all volunteers with name, code, trip count.
  @Get("volunteers")
  async volunteers(@Req() req: any) {
    this.checkKey(req);
    return this.admin.listVolunteers();
  }

  // GET /admin/reanalyze?key=  — re-run the engine over EVERY completed trip and
  // overwrite its stored analysis. Use after deploying an engine change so
  // existing trips pick up the new logic. Returns { analyzed, skipped }.
  @Get("reanalyze")
  async reanalyze(@Req() req: any) {
    this.checkKey(req);
    return this.commute.reanalyzeAll();
  }

  // GET /admin/reanalyze/<id>?key=  — re-run the engine on ONE trip (quick test).
  @Get("reanalyze/:id")
  async reanalyzeOne(@Param("id") id: string, @Req() req: any) {
    this.checkKey(req);
    const j = await this.commute.analyzeAndStore(id);
    if (!j) throw new NotFoundException(`Trip ${id} not found / no data`);
    return { ok: true, tripId: id, legs: j.legs.length };
  }

  // Auth via x-api-key header (used by the dashboard) OR ?key= (browser testing).
  private checkKey(req: any) {
    const provided = req.headers["x-api-key"] ?? req.query.key;
    if (!process.env.API_KEY || provided !== process.env.API_KEY) {
      throw new UnauthorizedException("Invalid or missing API key");
    }
  }
}