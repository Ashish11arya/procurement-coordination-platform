import { Controller, Post, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { DemoService } from './demo.service';
import { Public } from '../../shared/decorators/public.decorator';

@Controller('demo')
@Public()
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('reset-and-seed')
  @HttpCode(HttpStatus.OK)
  async resetAndSeed() {
    return this.demoService.resetAndSeedDemo();
  }

  @Post('step/:stepNumber')
  @HttpCode(HttpStatus.OK)
  async executeStep(@Param('stepNumber') stepNumber: string) {
    switch (stepNumber) {
      case '1':
        return this.demoService.executeStep1();
      case '2':
        return this.demoService.executeStep2();
      case '3':
        return this.demoService.executeStep3();
      case '4':
        return this.demoService.executeStep4();
      case '5':
        return this.demoService.executeStep5();
      case '6':
        return this.demoService.executeStep6();
      default:
        return { error: `Invalid step number: ${stepNumber}. Must be 1 to 6.` };
    }
  }

  @Post('run-scenario')
  @HttpCode(HttpStatus.OK)
  async runScenario() {
    return this.demoService.runFullScenario();
  }

  @Get('roster')
  async getRoster() {
    return this.demoService.getLiveRoster();
  }
}
