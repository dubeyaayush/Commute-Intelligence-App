import { Module } from '@nestjs/common';
import { CommuteController } from './commute.controller';
import { CommuteService } from './commute.service';

@Module({
  controllers: [CommuteController],
  providers: [CommuteService],
})
export class CommuteModule {}