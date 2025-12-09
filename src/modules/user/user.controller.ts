import { Body, Controller, Post, ValidationPipe, Get } from "@nestjs/common";
import { UserService } from "./user.service";
import { BulkUploadDto, BulkUploadResponseDto } from "./dto/bulk-upload.dto";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("bulk-upload")
  async bulkUpload(
    @Body(new ValidationPipe({ transform: true })) dto: BulkUploadDto
  ): Promise<BulkUploadResponseDto> {
    const result = await this.userService.bulkCreate(dto.users);

    return {
      created: result.created,
      total: dto.users.length,
      linked: result.linked,
      message: `Successfully processed ${dto.users.length} users. Created: ${
        result.created
      }, Skipped: ${dto.users.length - result.created}, Receiver links: ${result.linked}`,
    };
  }

  @Get()
  async getAllUsers() {
    return await this.userService.findAll();
  }
}
