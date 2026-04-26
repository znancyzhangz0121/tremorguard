import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest, AuthGuard } from '../auth/auth.guard';
import { BindDeviceDto } from './dto/bind-device.dto';
import { DisconnectDeviceDto } from './dto/disconnect-device.dto';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(
    @Inject(DevicesService)
    private readonly devicesService: DevicesService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user device binding' })
  getMine(@Req() request: AuthenticatedRequest) {
    return this.devicesService.getMine(request.authUser?.email ?? '');
  }

  @Post('bind')
  @ApiOperation({ summary: 'Bind or rebind a device to current user' })
  bind(@Req() request: AuthenticatedRequest, @Body() body: BindDeviceDto) {
    return this.devicesService.bind(request.authUser?.email ?? '', body);
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect current user device' })
  disconnect(
    @Req() request: AuthenticatedRequest,
    @Body() _body: DisconnectDeviceDto,
  ) {
    return this.devicesService.disconnect(request.authUser?.email ?? '');
  }
}
