using Microsoft.EntityFrameworkCore;

namespace ContosoUniversity.Data
{
    public static class SchoolContextFactory
    {
        public static SchoolContext Create()
        {
            var optionsBuilder = new DbContextOptionsBuilder<SchoolContext>();
            optionsBuilder.UseNpgsql("Host=localhost;Database=contoso;Username=postgres;Password=F3r6u5@n!");

            return new SchoolContext(optionsBuilder.Options);
        }
    }
}
