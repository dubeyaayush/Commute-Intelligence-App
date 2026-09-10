import { Controller, Get, Param, Req, UnauthorizedException } from '@nestjs/common';
import { CommuteService } from './commute.service';

@Controller('commute')
export class CommuteController {
  constructor(private readonly commute: CommuteService) {}

  // GET /commute/<id>?key=<API_KEY>  — engine output as JSON (browser-openable)
  @Get(':id')
  async analyze(@Param('id') id: string, @Req() req: any) {
    const provided = req.headers['x-api-key'] ?? req.query.key;
    if (!process.env.API_KEY || provided !== process.env.API_KEY) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    const journey = await this.commute.analyze(id);
    if (!journey) throw new UnauthorizedException('Trip not found'); // keep it simple for now
    return journey;
  }
}