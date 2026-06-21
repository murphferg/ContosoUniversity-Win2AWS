using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ContosoUniversity.Data;
using ContosoUniversity.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContosoUniversity.Controllers.Api
{
    [ApiController]
    [Route("api/statistics")]
    public class StatisticsApiController : ControllerBase
    {
        private readonly SchoolContext _context;

        public StatisticsApiController(SchoolContext context)
        {
            _context = context;
        }

        // GET: api/statistics/enrollment-stats
        [HttpGet("enrollment-stats")]
        public async Task<ActionResult<List<EnrollmentStatDto>>> GetEnrollmentStats()
        {
            var stats = await _context.Students
                .GroupBy(s => s.EnrollmentDate)
                .Select(g => new { EnrollmentDate = g.Key, StudentCount = g.Count() })
                .OrderBy(s => s.EnrollmentDate)
                .ToListAsync();

            var result = stats
                .Select(s => new EnrollmentStatDto(s.EnrollmentDate, s.StudentCount))
                .ToList();

            return Ok(result);
        }
    }
}
