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

  // GET /commute/<tripId>
  // The app's read endpoint: returns the engine's full journey reconstruction
  // (legs, modes, ride-starts, metro arrivals, confidences).
  // Auth via the x-api-key header (what the Flutter app sends) OR ?key= in the
  // query (convenient for opening in a browser while debugging).
  @Get(':id')
  async analyze(@Param('id') id: string, @Req() req: any) {
    const provided = req.headers['x-api-key'] ?? req.query.key;
    if (!process.env.API_KEY || provided !== process.env.API_KEY) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    const journey = await this.commute.analyze(id);
    // 404 (not 401) so a client can tell "no such trip" from "bad key".
    if (!journey) throw new NotFoundException(`Trip ${id} not found`);
    return journey;
  }
}