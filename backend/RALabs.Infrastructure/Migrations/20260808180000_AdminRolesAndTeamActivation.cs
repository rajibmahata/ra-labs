using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RALabs.Infrastructure.Migrations;

public partial class AdminRolesAndTeamActivation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Role",
            table: "AdminUsers",
            type: "nvarchar(30)",
            maxLength: 30,
            nullable: false,
            defaultValue: "admin");

        migrationBuilder.AddColumn<bool>(
            name: "IsActive",
            table: "TeamMembers",
            type: "bit",
            nullable: false,
            defaultValue: true);

        migrationBuilder.Sql("UPDATE AdminUsers SET Role = 'super_admin' WHERE Email = 'rajib@ralabs.dev'");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "Role", table: "AdminUsers");
        migrationBuilder.DropColumn(name: "IsActive", table: "TeamMembers");
    }
}