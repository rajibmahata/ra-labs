using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RALabs.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AdminAuthResetRefresh : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PasswordResetToken",
                table: "AdminUsers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordResetTokenExpiresAt",
                table: "AdminUsers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefreshTokenExpiresAt",
                table: "AdminUsers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefreshTokenHash",
                table: "AdminUsers",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordResetToken",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "PasswordResetTokenExpiresAt",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "RefreshTokenExpiresAt",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "RefreshTokenHash",
                table: "AdminUsers");
        }
    }
}
