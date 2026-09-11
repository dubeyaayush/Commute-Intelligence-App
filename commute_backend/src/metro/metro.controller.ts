import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { MetroService } from './metro.service';

@Controller('metro')
export class MetroController {
  constructor(private readonly metro: MetroService) {}

  // GET /metro/import?key=<API_KEY>
  // NOTE: a mutating action behind GET is a deliberate dev convenience so this
  // one-time admin import is browser-triggerable. Swap to a guarded POST before
  // this ever ships to real users.
  @Get('import')
  async import(@Req() req: any) {
    const provided = req.headers['x-api-key'] ?? req.query.key;
    if (!process.env.API_KEY || provided !== process.env.API_KEY) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return this.metro.importFromOsm();
  }
}