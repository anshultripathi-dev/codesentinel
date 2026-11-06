using System;

namespace Billing.Models
{
    /// <summary>Customer record with small, focused members (sample code for CodeSentinel demos).</summary>
    public class CustomerRecord
    {
        public string Id { get; }
        public string Name { get; private set; }
        public string Email { get; private set; }
        public DateTime Joined { get; }

        public CustomerRecord(string id, string name, string email, DateTime joined)
        {
            Id = id;
            Name = name;
            Email = email;
            Joined = joined;
        }

        public int YearsSinceJoined(DateTime now)
        {
            return (int)((now - Joined).TotalDays / 365.25);
        }

        public void Rename(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("name required");
            }
            Name = name.Trim();
        }

        public bool HasValidEmail()
        {
            return Email != null && Email.Contains("@") && Email.IndexOf('.') > Email.IndexOf('@');
        }

        public override string ToString()
        {
            return Id + ": " + Name;
        }
    }
}
