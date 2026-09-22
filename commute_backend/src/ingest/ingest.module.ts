import { Module } from '@nestjs/common';
import { CommuteModule } from '../commute/commute.module';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

@Module({
  imports: [CommuteModule],
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}