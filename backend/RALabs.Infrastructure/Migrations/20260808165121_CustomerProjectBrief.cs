using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RALabs.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CustomerProjectBrief : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Audience",
                table: "CustomerProjects",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BudgetOrConstraints",
                table: "CustomerProjects",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Goal",
                table: "CustomerProjects",
                type: "nvarchar(max)",
                maxLength: 5000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceLinks",
                table: "CustomerProjects",
                type: "nvarchar(3000)",
                maxLength: 3000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Requirements",
                table: "CustomerProjects",
                type: "nvarchar(max)",
                maxLength: 10000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Timeline",
                table: "CustomerProjects",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Audience",
                table: "CustomerProjects");

            migrationBuilder.DropColumn(
                name: "BudgetOrConstraints",
                table: "CustomerProjects");

            migrationBuilder.DropColumn(
                name: "Goal",
                table: "CustomerProjects");

            migrationBuilder.DropColumn(
                name: "ReferenceLinks",
                table: "CustomerProjects");

            migrationBuilder.DropColumn(
                name: "Requirements",
                table: "CustomerProjects");

            migrationBuilder.DropColumn(
                name: "Timeline",
                table: "CustomerProjects");
        }
    }
}
