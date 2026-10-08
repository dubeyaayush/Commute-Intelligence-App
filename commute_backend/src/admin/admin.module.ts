import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommuteModule } from '../commute/commute.module';

@Module({
  imports: [CommuteModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}