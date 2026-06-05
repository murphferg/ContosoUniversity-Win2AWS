using Microsoft.EntityFrameworkCore;
using System.Configuration;

namespace ContosoUniversity.Data
{
    public static class SchoolContextFactory
    {
        public static SchoolContext Create()
        {
            var connectionString = ConfigurationManager.ConnectionStrings["DefaultConnection"];
            var optionsBuilder = new DbContextOptionsBuilder<SchoolContext>();
            optionsBuilder.UseSqlServer(connectionString.ConnectionString);

            return new SchoolContext(optionsBuilder.Options);
        }
    }
}
