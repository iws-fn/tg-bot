import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class UserDto {
  @IsString()
  @IsNotEmpty()
  fio: string;

  @IsString()
  @IsOptional()
  receiver_fio?: string;
}

export class BulkUploadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserDto)
  users: UserDto[];
}

export class BulkUploadResponseDto {
  created: number;
  total: number;
  linked: number;
  message: string;
}

