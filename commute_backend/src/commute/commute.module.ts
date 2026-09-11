import { Module } from '@nestjs/common';
import { MetroModule } from '../metro/metro.module';
import { CommuteController } from './commute.controller';
import { CommuteService } from './commute.service';

@Module({
  imports: [MetroModule],
  controllers: [CommuteController],
  providers: [CommuteService],
})
export class CommuteModule {}