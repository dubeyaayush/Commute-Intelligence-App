import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { ApiKeyGuard } from '../common/api-key.guard';

@Controller('ingest')
@UseGuards(ApiKeyGuard) // every route here requires the API key
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  // POST /ingest — receives one trip payload from the app.
  @Post()
  async receive(@Body() body: any) {
    return this.ingest.ingest(body);
  }
}