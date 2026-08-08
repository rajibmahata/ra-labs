using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RALabs.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GithubCredentials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GithubAccountUrl",
                table: "TeamMembers",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GithubTokenEncrypted",
                table: "TeamMembers",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GithubAccountUrl",
                table: "TeamMembers");

            migrationBuilder.DropColumn(
                name: "GithubTokenEncrypted",
                table: "TeamMembers");
        }
    }
}
