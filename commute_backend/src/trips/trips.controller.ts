import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TripsService } from './trips.service';
import { ApiKeyGuard } from '../common/api-key.guard';

@Controller('trips')
@UseGuards(ApiKeyGuard) // reads are protected too
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  // GET /trips?volunteer=A-10
  @Get()
  list(@Query('volunteer') volunteer?: string) {
    return this.trips.list(volunteer);
  }

  // GET /trips/<id>
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.trips.getOne(id);
  }
}