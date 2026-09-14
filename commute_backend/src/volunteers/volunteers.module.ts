import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Volunteer } from './volunteer.entity';
import { VolunteersService } from './volunteers.service';
import { VolunteersController } from './volunteers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Volunteer])],
  controllers: [VolunteersController],
  providers: [VolunteersService],
})
export class VolunteersModule {}