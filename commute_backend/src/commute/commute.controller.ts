import {
  Controller,
  Get,
  Param,
  Req,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CommuteService } from './commute.service';

@Controller('commute')
export class CommuteController {
  constructor(private readonly commute: CommuteService) {}

  // GET /commute/reanalyze/all?key=<API_KEY>  — one-time backfill of stored analysis.
  @Get('reanalyze/all')
  async reanalyzeAll(@Req() req: any) {
    this.checkKey(req);
    return this.commute.reanalyzeAll();
  }

  // GET /commute/<tripId>  — the engine's journey (used by the app + dashboard).
  @Get(':id')
  async analyze(@Param('id') id: string, @Req() req: any) {
    this.checkKey(req);
    const journey = await this.commute.analyze(id);
    if (!journey) throw new NotFoundException(`Trip ${id} not found`);
    return journey;
  }

  private checkKey(req: any) {
    const provided = req.headers['x-api-key'] ?? req.query.key;
    if (!process.env.API_KEY || provided !== process.env.API_KEY) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
  }
}