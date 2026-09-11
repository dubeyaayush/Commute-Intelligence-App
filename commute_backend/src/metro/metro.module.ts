import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetroStation } from './metro-station.entity';
import { MetroService } from './metro.service';
import { MetroController } from './metro.controller';
import { MetroArrivalService } from './metro-arrival.service';

@Module({
  imports: [TypeOrmModule.forFeature([MetroStation])],
  controllers: [MetroController],
  providers: [MetroService, MetroArrivalService],
  exports: [MetroArrivalService], // used by CommuteModule
})
export class MetroModule {}