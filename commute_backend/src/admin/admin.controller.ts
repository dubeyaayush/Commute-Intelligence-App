import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // GET /admin/trips?volunteer=&quality=&limit=&key=  — all trips (dashboard list).
  @Get('trips')
  async trips(
    @Req() req: any,
    @Query('volunteer') volunteer?: string,
    @Query('quality') quality?: string,
    @Query('limit') limit?: string,
  ) {
    this.checkKey(req);
    return this.admin.listTrips({ volunteer, quality, limit });
  }

  // GET /admin/trips/<id>?key=  — one trip's full analysis + GPS track + labels.
  @Get('trips/:id')
  async trip(@Param('id') id: string, @Req() req: any) {
    this.checkKey(req);
    const t = await this.admin.getTrip(id);
    if (!t) throw new NotFoundException(`Trip ${id} not analysed / not found`);
    return t;
  }

  // Auth via x-api-key header (used by the dashboard) OR ?key= (browser testing).
  private checkKey(req: any) {
    const provided = req.headers['x-api-key'] ?? req.query.key;
    if (!process.env.API_KEY || provided !== process.env.API_KEY) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
  }
}